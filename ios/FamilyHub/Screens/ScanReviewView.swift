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
        Card(title: "Scan a pharmacy label", icon: "camera.fill") {
            Text("Photographs the label and fills in the fields for you to check. Nothing is saved until you press Add.")
                .fhFont(.base)
                .foregroundStyle(FH.inkSoft)

            HStack(spacing: 10) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    BigButton(title: "Scan a label", icon: "camera.fill") {
                        showCamera = true
                    }
                }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    HStack(spacing: 10) {
                        Image(systemName: "photo").fontWeight(.bold)
                        Text("Choose a photo")
                    }
                    .fhFont(.base, weight: .bold)
                    .foregroundStyle(FH.ink)
                    .padding(.horizontal, 24)
                    .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                    .chrome()
                }
                .buttonStyle(PressableStyle())
            }

            if busy {
                Label("Reading the label…", systemImage: "hourglass")
                    .fhFont(.base)
                    .foregroundStyle(FH.inkSoft)
            }
            if scanFailed {
                InlineError(text: "Couldn't read the label. You can still type it in with Add medication.")
            }

            if !candidates.isEmpty {
                Text("Check each line against the label before adding. The scan can misread.")
                    .fhFont(.base, weight: .bold)
                Toggle("Keep the photo with this medication", isOn: $keepPhoto)
                    .fhFont(.base)
                    .tint(FH.brand)
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
        Well {
            FieldLabel(title: "Medication name") {
                TextField("", text: candidate.name).fhField()
            }
            FieldLabel(title: "Dose, as written on the label") {
                TextField("", text: candidate.dose).fhField()
            }
            FieldLabel(title: "When it's taken") {
                Picker("When it's taken", selection: candidate.slot) {
                    Text("Morning").tag("morning")
                    Text("Noon").tag("noon")
                    Text("Evening").tag("evening")
                    Text("Bedtime").tag("bedtime")
                }
                .pickerStyle(.segmented)
                .frame(minHeight: 48)
            }
            FieldLabel(title: "Prescriber", optional: true) {
                TextField("", text: candidate.prescriber).fhField()
            }
            BigButton(title: "Add this medication", icon: "plus") {
                Task { await add(candidate.wrappedValue) }
            }
        }
        .fhFont(.base)
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
            banners.error("Couldn't add the medication. Please try again.")
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
