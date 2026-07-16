import XCTest

/// End-to-end mutation flow against the live tailnet server:
/// add a to-do → green confirmation banner → check it off → delete it.
/// Leaves the server state exactly as it found it.
final class TodoFlowUITests: XCTestCase {
    func testAddCheckDeleteTodo() throws {
        let app = XCUIApplication()
        app.launchEnvironment = [
            "FH_AUTO_USER": "admin",
            "FH_AUTO_PASS": "powers4w",
            "FH_AUTO_TAB": "todo",
        ]
        app.launch()

        // Reach the To-do screen (auto-tab needs an existing session; fall back to tapping).
        let addField = app.textFields["Add something…"]
        if !addField.waitForExistence(timeout: 15) {
            app.tabBars.buttons["To-do"].tap()
            XCTAssertTrue(addField.waitForExistence(timeout: 10), "To-do screen did not appear")
        }

        let itemText = "Simulator test item"

        // Add
        addField.tap()
        addField.typeText(itemText)
        app.buttons["Add"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Added to the list"].waitForExistence(timeout: 10),
                      "Confirmation banner did not appear after add")
        XCTAssertTrue(app.staticTexts[itemText].waitForExistence(timeout: 10),
                      "New to-do did not appear in the list")

        // Check off
        app.buttons["Check off \(itemText)"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Checked off ✓"].waitForExistence(timeout: 10),
                      "Confirmation banner did not appear after check-off")

        // Delete (through the confirm dialog)
        app.buttons["Remove \(itemText)"].firstMatch.tap()
        let confirmRemove = app.buttons["Remove"].firstMatch
        XCTAssertTrue(confirmRemove.waitForExistence(timeout: 5), "Confirm dialog did not appear")
        confirmRemove.tap()

        // Gone
        let gone = app.staticTexts[itemText].waitForNonExistence(timeout: 10)
        XCTAssertTrue(gone, "Deleted to-do still visible")
    }
}

private extension XCUIElement {
    func waitForNonExistence(timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: self)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }
}
