import SwiftUI

/// Admin month calendar, mirroring MonthView.tsx: a 7-column grid fed by
/// /api/appointments?start=&end= computed per month.
struct MonthView: View {
    @State private var monthAnchor = Date()
    @State private var occurrences: [Occurrence] = []

    private var calendar: Calendar { Calendar.current }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: monthAnchor)
    }

    /// Grid cells: leading blanks + one entry per day of the month.
    private var cells: [(id: Int, day: Int?, dateKey: String?)] {
        let comps = calendar.dateComponents([.year, .month], from: monthAnchor)
        guard let firstOfMonth = calendar.date(from: comps),
              let range = calendar.range(of: .day, in: .month, for: monthAnchor) else { return [] }
        let leadingBlanks = (calendar.component(.weekday, from: firstOfMonth) - calendar.firstWeekday + 7) % 7
        var result: [(Int, Int?, String?)] = []
        for i in 0..<leadingBlanks {
            result.append((-(i + 1), nil, nil))
        }
        for day in range {
            let key = String(format: "%04d-%02d-%02d", comps.year!, comps.month!, day)
            result.append((day, day, key))
        }
        return result
    }

    private var byDay: [String: [Occurrence]] {
        Dictionary(grouping: occurrences) { String($0.start.prefix(10)) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    IconButton(systemName: "arrow.left", label: "Previous month") { shift(-1) }
                    Spacer()
                    Text(monthTitle).fhDisplay(.title).accessibilityAddTraits(.isHeader)
                    Spacer()
                    IconButton(systemName: "arrow.right", label: "Next month") { shift(1) }
                }

                let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
                LazyVGrid(columns: columns, spacing: 4) {
                    ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { label in
                        Text(label).fhFont(.small, weight: .bold).foregroundStyle(FH.inkSoft)
                    }
                    ForEach(cells, id: \.id) { cell in
                        dayCell(cell.day, cell.dateKey)
                    }
                }
            }
            .padding(20)
            .glass()
            .padding(16)
        }
        .groundBackground()
        .task(id: Format.isoDate(monthAnchor)) { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func dayCell(_ day: Int?, _ dateKey: String?) -> some View {
        let isToday = dateKey == Format.isoDate(Date())
        VStack(alignment: .leading, spacing: 2) {
            if let day {
                Text("\(day)").fhDisplay(.small)
                ForEach(byDay[dateKey ?? ""] ?? []) { occurrence in
                    Text(occurrence.title)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(FH.brand, in: RoundedRectangle(cornerRadius: 6))
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
        .padding(6)
        .background {
            if day != nil { WellSurface(radius: 12) }
        }
        .overlay {
            if isToday {
                RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(FH.brand, lineWidth: 3)
            }
        }
    }

    private func shift(_ delta: Int) {
        if let next = calendar.date(byAdding: .month, value: delta, to: monthAnchor) {
            monthAnchor = next
        }
    }

    private func load() async {
        let comps = calendar.dateComponents([.year, .month], from: monthAnchor)
        guard let first = calendar.date(from: comps),
              let nextMonth = calendar.date(byAdding: .month, value: 1, to: first) else { return }
        let query = [
            URLQueryItem(name: "start", value: Format.isoDate(first) + "T00:00:00"),
            URLQueryItem(name: "end", value: Format.isoDate(nextMonth) + "T00:00:00"),
        ]
        if let list: [Occurrence] = try? await APIClient.shared.get("/api/appointments", query: query) {
            occurrences = list
        }
    }
}
