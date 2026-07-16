import Foundation

enum APIError: LocalizedError {
    case http(status: Int, detail: String)
    case notJSON            // SPA catch-all returned HTML — wrong path or server misconfig
    case noServer

    var errorDescription: String? {
        switch self {
        case .http(_, let detail): return detail
        case .notJSON: return "Unexpected reply from the server. Check the server address."
        case .noServer: return "No server address set."
        }
    }

    var isAuthFailure: Bool {
        if case .http(let status, _) = self { return status == 401 }
        return false
    }
}

/// JSON client for the family-hub API. Session auth rides on the `fh_session`
/// cookie, which URLSession's shared HTTPCookieStorage stores and re-sends
/// automatically (it has no Secure flag, so plain http over the tailnet works).
/// On a 401 we re-login once with Keychain credentials, then retry.
final class APIClient: @unchecked Sendable {
    static let shared = APIClient()

    static let serverURLKey = "fh.serverURL"

    var serverURL: String {
        get { UserDefaults.standard.string(forKey: Self.serverURLKey) ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: Self.serverURLKey) }
    }

    private let session: URLSession = .shared
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    /// Called when re-login fails — the shell uses it to bounce to the login screen.
    var onAuthExpired: (@MainActor () -> Void)?

    private init() {
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    private struct ErrorDetail: Decodable { var detail: String? }
    private struct Empty: Encodable {}

    private func url(_ path: String, query: [URLQueryItem] = []) throws -> URL {
        guard !serverURL.isEmpty, var comps = URLComponents(string: serverURL) else {
            throw APIError.noServer
        }
        // No trailing slashes — FastAPI registers exact paths and a trailing
        // slash falls through to the SPA catch-all (HTML 200).
        comps.path = path
        if !query.isEmpty { comps.queryItems = query }
        guard let url = comps.url else { throw APIError.noServer }
        return url
    }

    // MARK: - Public verbs

    func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        try await send(method: "GET", path: path, query: query, body: nil as Empty?)
    }

    func post<T: Decodable>(_ path: String) async throws -> T {
        try await send(method: "POST", path: path, body: nil as Empty?)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, _ body: B) async throws -> T {
        try await send(method: "POST", path: path, body: body)
    }

    func put<T: Decodable, B: Encodable>(_ path: String, _ body: B) async throws -> T {
        try await send(method: "PUT", path: path, body: body)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await send(method: "DELETE", path: path, body: nil as Empty?)
    }

    /// Multipart upload for the label scan (field name must be `file`).
    func upload<T: Decodable>(_ path: String, imageData: Data, filename: String = "label.jpg",
                              mimeType: String = "image/jpeg") async throws -> T {
        var request = URLRequest(url: try url(path))
        request.httpMethod = "POST"
        let boundary = "fh-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body
        return try await perform(request, retryOn401: true)
    }

    // MARK: - Auth

    @discardableResult
    func login(username: String, password: String) async throws -> User {
        struct Creds: Encodable { var username: String; var password: String }
        let out: LoginOut = try await send(method: "POST", path: "/api/auth/login",
                                           body: Creds(username: username, password: password),
                                           retryOn401: false)
        return out.user
    }

    func logout() async {
        let _: OkOut? = try? await post("/api/auth/logout")
    }

    // MARK: - Core

    private func send<T: Decodable, B: Encodable>(method: String, path: String,
                                                  query: [URLQueryItem] = [],
                                                  body: B?, retryOn401: Bool = true) async throws -> T {
        var request = URLRequest(url: try url(path, query: query))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        return try await perform(request, retryOn401: retryOn401)
    }

    private func perform<T: Decodable>(_ request: URLRequest, retryOn401: Bool) async throws -> T {
        do {
            return try await performOnce(request)
        } catch let error as APIError where error.isAuthFailure && retryOn401 {
            guard let creds = Keychain.loadCredentials() else {
                await MainActor.run { self.onAuthExpired?() }
                throw error
            }
            do {
                try await login(username: creds.username, password: creds.password)
            } catch {
                await MainActor.run { self.onAuthExpired?() }
                throw error
            }
            return try await performOnce(request)
        }
    }

    private func performOnce<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.notJSON }
        let contentType = http.value(forHTTPHeaderField: "Content-Type") ?? ""
        guard (200..<300).contains(http.statusCode) else {
            var detail = "Request failed (\(http.statusCode))"
            if contentType.contains("application/json"),
               let parsed = try? decoder.decode(ErrorDetail.self, from: data),
               let d = parsed.detail {
                detail = d
            }
            throw APIError.http(status: http.statusCode, detail: detail)
        }
        // A missing /api prefix or trailing slash lands on the SPA and returns HTML 200.
        guard contentType.contains("application/json") else { throw APIError.notJSON }
        return try decoder.decode(T.self, from: data)
    }
}
