import SwiftUI
import PhotosUI

/// Admin label-scan flow, mirroring ScanReview.tsx:
/// photo → POST /medications/scan (writes nothing) → editable candidates →
/// each "Add to regimen" goes through the normal med-create with scan_id.
/// The scan only transcribes; a human reviews and confirms every field.
struct ScanReviewView: View {
    @Environment(BannerCenter.self) private var banners
    var person: Person
    var onAdded: () async -> Void

    @State private var showCamera = false
    @State private var photoItem: PhotosPickerItem?
    @State private var busy = false
    @State private var scanId: String?
    @State private var candidates: [EditableCandidate] = []
    @State private var keepPhoto = false
    @State private var scanFailed = false

    struct EditableCandidate: Identifiable {
        let id = UUID()
        var name: String
        var dose: String
        var slot: String
        var prescriber: String
    }

    var body: some View {
        Card {
            Text("Scan a pharmacy label").fhFont(.base, weight: .bold)
            Text("The scan only reads the text — you check every field before anything is saved.")
                .fhFont(.small)
                .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button {
                        showCamera = true
                    } label: {
                        Label("📷 Scan label", systemImage: "camera")
                            .fhFont(.base, weight: .semibold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                            .background(FH.brand, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Choose photo", systemImage: "photo")
                        .fhFont(.base, weight: .semibold)
                        .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                        .background(Color(.systemGray5), in: RoundedRectangle(cornerRadius: 14))
                }
            }

            if busy {
                Label("Reading the label…", systemImage: "hourglass")
                    .fhFont(.base)
                    .foregroundStyle(.secondary)
            }
            if scanFailed {
                Text("Couldn't read the label — you can still type it in manually above.")
                    .fhFont(.base)
                    .foregroundStyle(FH.danger)
            }

            if !candidates.isEmpty {
                Text("Check each field against the label — the scan can misread.")
                    .fhFont(.small, weight: .semibold)
                    .foregroundStyle(FH.danger)
                Toggle("Keep photo with these entries", isOn: $keepPhoto)
                    .fhFont(.base)
                ForEach($candidates) { $candidate in
                    candidateRow($candidate)
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                Task { await scan(image) }
            }
            .ignoresSafeArea()
        }
        .onChange(of: photoItem) {
            guard let item = photoItem else { return }
            photoItem = nil
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    await scan(image)
                }
            }
        }
    }

    private func candidateRow(_ candidate: Binding<EditableCandidate>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Name", text: candidate.name)
                .textFieldStyle(.roundedBorder)
            TextField("Dose — exactly as on the label", text: candidate.dose)
                .textFieldStyle(.roundedBorder)
            Picker("Time of day", selection: candidate.slot) {
                Text("Morning").tag("morning")
                Text("Noon").tag("noon")
                Text("Evening").tag("evening")
                Text("Bedtime").tag("bedtime")
            }
            .pickerStyle(.segmented)
            TextField("Prescriber (optional)", text: candidate.prescriber)
                .textFieldStyle(.roundedBorder)
            BigButton(title: "Add to regimen", icon: "plus") {
                Task { await add(candidate.wrappedValue) }
            }
        }
        .fhFont(.base)
        .padding(12)
        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
    }

    private func scan(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        busy = true
        scanFailed = false
        defer { busy = false }
        do {
            let result: ScanResult = try await APIClient.shared.upload(
                "/api/people/\(person.id)/medications/scan", imageData: data)
            scanId = result.scanId
            candidates = result.candidates.map {
                EditableCandidate(name: $0.name ?? "", dose: $0.dose ?? "",
                                  slot: $0.slot ?? "morning", prescriber: $0.prescriber ?? "")
            }
            if candidates.isEmpty { scanFailed = true }
        } catch {
            // The backend surfaces an unavailable scanner as a raw 500.
            scanFailed = true
        }
    }

    private func add(_ candidate: EditableCandidate) async {
        do {
            let body = MedIn(name: candidate.name, dose: candidate.dose, slot: candidate.slot,
                             prescriber: candidate.prescriber.isEmpty ? nil : candidate.prescriber,
                             scanId: scanId, keepPhoto: keepPhoto)
            let _: Med = try await APIClient.shared.post("/api/people/\(person.id)/medications", body)
            banners.confirm("Added \(candidate.name)")
            candidates.removeAll { $0.id == candidate.id }
            await onAdded()
        } catch {
            banners.error(error.localizedDescription)
        }
    }
}

/// UIKit camera wrapper (SwiftUI has no native camera view).
struct CameraPicker: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    var onImage: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImage(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
