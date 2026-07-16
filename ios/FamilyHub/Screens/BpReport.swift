import SwiftUI

/// Native replacement for the server's HTML-only /bp/export page: a printable
/// PDF summary of recent readings for handing to a clinician.
enum BpReport {
    @MainActor
    static func makePDF(person: Person, view: BpView, days: String) -> URL? {
        let content = BpReportPage(person: person, view: view, days: days)
            .frame(width: 612)   // US Letter width in points
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: 612, height: nil)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("BP-\(person.name)-readings.pdf")
        var succeeded = false
        renderer.render { size, draw in
            var box = CGRect(origin: .zero, size: CGSize(width: 612, height: max(size.height, 792)))
            guard let pdf = CGContext(url as CFURL, mediaBox: &box, nil) else { return }
            pdf.beginPDFPage(nil)
            // Flip: ImageRenderer draws in a top-left origin space.
            pdf.translateBy(x: 0, y: box.height)
            pdf.scaleBy(x: 1, y: -1)
            pdf.translateBy(x: 0, y: box.height - size.height)
            draw(pdf)
            pdf.endPDFPage()
            pdf.closePDF()
            succeeded = true
        }
        return succeeded ? url : nil
    }
}

private struct BpReportPage: View {
    var person: Person
    var view: BpView
    var days: String

    private var periodLabel: String {
        days == "0" ? "All readings" : "Last \(days) days"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Blood pressure readings — \(person.name)")
                .font(.system(size: 22, weight: .bold))
            Text(periodLabel)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)

            if let target = view.target {
                Text("\(target.doctorLabel)'s target: systolic \(target.sysLow)–\(target.sysHigh), diastolic \(target.diaLow)–\(target.diaHigh)")
                    .font(.system(size: 14, weight: .semibold))
            }

            Divider()

            Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 6) {
                GridRow {
                    Text("Date").bold()
                    Text("Systolic").bold()
                    Text("Diastolic").bold()
                    Text("Pulse").bold()
                    Text("Note").bold()
                }
                .font(.system(size: 13))
                ForEach(view.readings) { reading in
                    GridRow {
                        Text(Format.dayAndTime(reading.takenAt))
                        Text("\(reading.systolic)")
                        Text("\(reading.diastolic)")
                        Text(reading.pulse.map(String.init) ?? "—")
                        Text(reading.note ?? "")
                    }
                    .font(.system(size: 13))
                }
            }

            Divider()

            Text("This is a family-kept record, not medical advice.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
        .padding(36)
        .background(Color.white)
        .foregroundStyle(Color.black)
    }
}
