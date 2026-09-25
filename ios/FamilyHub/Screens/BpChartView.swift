import SwiftUI
import Charts

/// Two-line trend chart mirroring BpChart.tsx: clinically neutral — series are
/// distinguished by line STYLE (systolic solid, diastolic dashed, pulse dotted),
/// one ink color, no red/green, no bands. Doctor target shows as faint dashed
/// reference lines labeled with the doctor's name.
struct BpChartView: View {
    var readings: [Reading]   // oldest → newest
    var target: BpTarget?
    var showPulse: Bool

    private struct Point: Identifiable {
        var id: Int
        var index: Int
        var label: String
        var systolic: Int
        var diastolic: Int
        var pulse: Int?
    }

    private var points: [Point] {
        readings.enumerated().map { index, reading in
            Point(id: reading.id, index: index,
                  label: Format.shortDay(reading.takenAt),
                  systolic: reading.systolic, diastolic: reading.diastolic, pulse: reading.pulse)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if points.count < 2 {
                Text("Not enough readings for a trend yet. Save two or more and the lines appear here.")
                    .fhFont(.base)
                    .foregroundStyle(FH.inkSoft)
            } else {
                chart
                legend
            }
        }
    }

    private var chart: some View {
        Chart {
            ForEach(points) { point in
                LineMark(x: .value("Reading", point.index),
                         y: .value("Systolic", point.systolic),
                         series: .value("Series", "Systolic"))
                    .foregroundStyle(FH.ink)
                    .lineStyle(StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            }
            ForEach(points) { point in
                LineMark(x: .value("Reading", point.index),
                         y: .value("Diastolic", point.diastolic),
                         series: .value("Series", "Diastolic"))
                    .foregroundStyle(FH.ink)
                    .lineStyle(StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round, dash: [12, 9]))
            }
            if showPulse {
                ForEach(points.filter { $0.pulse != nil }) { point in
                    LineMark(x: .value("Reading", point.index),
                             y: .value("Pulse", point.pulse!),
                             series: .value("Series", "Pulse"))
                        .foregroundStyle(FH.ink.opacity(0.7))
                        .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, dash: [1, 7]))
                }
            }
            if let target {
                RuleMark(y: .value("Target systolic", target.sysHigh))
                    .foregroundStyle(FH.ink.opacity(0.35))
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                    .annotation(position: .top, alignment: .leading) {
                        Text("\(target.doctorLabel)'s target (systolic \(target.sysLow)–\(target.sysHigh))")
                            .fhFont(.small)
                            .foregroundStyle(.secondary)
                    }
                RuleMark(y: .value("Target diastolic", target.diaHigh))
                    .foregroundStyle(FH.ink.opacity(0.35))
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                    .annotation(position: .bottom, alignment: .leading) {
                        Text("\(target.doctorLabel)'s target (diastolic \(target.diaLow)–\(target.diaHigh))")
                            .fhFont(.small)
                            .foregroundStyle(.secondary)
                    }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { value in
                AxisGridLine()
                AxisValueLabel {
                    if let index = value.as(Int.self), index >= 0, index < points.count {
                        Text(points[index].label).fhFont(.small)
                    }
                }
            }
        }
        .chartLegend(.hidden)
        .frame(height: 260)
        .accessibilityLabel("Blood pressure trend chart. Systolic shown as a solid line, diastolic as a dashed line\(showPulse ? ", pulse as a dotted line" : "").")
    }

    /// Plain-language legend, matching the web: a line-style swatch beside the words.
    private var legend: some View {
        VStack(alignment: .leading, spacing: 6) {
            legendRow(dash: nil, text: "Systolic, the top number")
            legendRow(dash: [10, 7], text: "Diastolic, the bottom number")
            if showPulse {
                legendRow(dash: [1, 6], text: "Pulse")
            }
        }
        .fhFont(.base)
        .foregroundStyle(FH.inkSoft)
    }

    private func legendRow(dash: [CGFloat]?, text: String) -> some View {
        HStack(spacing: 10) {
            Path { path in
                path.move(to: CGPoint(x: 0, y: 2))
                path.addLine(to: CGPoint(x: 40, y: 2))
            }
            .stroke(FH.ink, style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: dash ?? []))
            .frame(width: 40, height: 4)
            .accessibilityHidden(true)
            Text(text)
        }
    }
}
