import SwiftUI
import SafariServices

@main
struct TabSuspenderHostApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

private struct ContentView: View {
    @State private var statusText = "Open Safari extension settings to enable Tab Suspender."

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Tab Suspender")
                .font(.title2)
            Text("Run this app once, then enable the Tab Suspender extension in Safari Settings > Extensions.")
                .fixedSize(horizontal: false, vertical: true)
            Button("Open Safari Extensions Settings") {
                openSafariExtensionPreferences()
            }
            Text(statusText)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(24)
        .frame(minWidth: 520, minHeight: 220)
    }

    private func openSafariExtensionPreferences() {
        SFSafariApplication.showPreferencesForExtension(
            withIdentifier: "com.tab.suspender.host.extension"
        ) { error in
            DispatchQueue.main.async {
                if let error {
                    statusText = "Unable to open Safari extension settings: \(error.localizedDescription)"
                    return
                }
                statusText = "Safari extension settings opened. Enable Tab Suspender there, then return to Safari."
            }
        }
    }
}
