const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths (relative to scripts/ directory)
const configPath = path.join(__dirname, '..', 'attenmo-config.json');
const statePath = path.join(__dirname, '..', 'attenmo-config-state.json');

// Files to update
const targetFiles = [
    path.join(__dirname, '..', 'README.md'),
    path.join(__dirname, '..', 'SECURITY.md'),
    path.join(__dirname, '..', 'CONTRIBUTING.md'),
    path.join(__dirname, '..', 'CODE_OF_CONDUCT.md'),
    path.join(__dirname, '..', 'public', 'manual.html'),
    path.join(__dirname, '..', 'public', 'about.html'),
    path.join(__dirname, '..', 'public', 'contact.html'),
    path.join(__dirname, '..', 'public', 'privacy-policy.html'),
    path.join(__dirname, '..', 'public', 'terms.html'),
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(__dirname, '..', 'public', 'feedback.html'),
    path.join(__dirname, '..', 'public', 'track.html'),
    path.join(__dirname, '..', 'attenmo-support-chatbot', 'src', 'components', 'ChatWidget.tsx'),
    path.join(__dirname, 'update-kb.js') // in the same scripts directory
];

// Default fallback values representing the current state of the repo
const defaultState = {
    developerName: "Shivam Kumar Mahto",
    developerEmail: "attenmo.tech@gmail.com",
    whatsappCommunity: "https://chat.whatsapp.com/GDOjvKK7nxGFvQ7NSrQNiG",
    instagramLink: "https://www.instagram.com/theattenmo/",
    instagramHandle: "@theattenmo",
    linkedinLink: "https://www.linkedin.com/in/shivam-kumar-mahto-046228361/",
    copyrightYear: "2026"
};

// 1. Read the target config
if (!fs.existsSync(configPath)) {
    console.error("❌ attenmo-config.json not found! Please create it.");
    process.exit(1);
}
const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 2. Read the previous state (or initialize with defaultState)
let previousState = { ...defaultState };
if (fs.existsSync(statePath)) {
    try {
        previousState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
        console.warn("⚠ Failed to parse state file. Using defaults.");
    }
} else {
    // Write the initial state file on the first run
    fs.writeFileSync(statePath, JSON.stringify(defaultState, null, 2), 'utf8');
}

// 3. Compare and check if anything needs updating
const keys = Object.keys(defaultState);
let hasChanges = false;
for (const key of keys) {
    if (currentConfig[key] !== previousState[key]) {
        hasChanges = true;
        break;
    }
}

if (!hasChanges) {
    console.log("✔ No detail changes detected in attenmo-config.json.");
} else {
    console.log("🔄 Changes detected in configuration details. Propagating updates across files...");
    
    // Helper to escape string for regex
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 4. Update all target files
    for (const filePath of targetFiles) {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠ Target file not found: ${filePath}`);
            continue;
        }

        let fileContent = fs.readFileSync(filePath, 'utf8');
        let fileUpdated = false;

        for (const key of keys) {
            const oldValue = previousState[key];
            const newValue = currentConfig[key];

            if (oldValue !== newValue) {
                // Perform global case-sensitive replacement of the old value with the new value
                const regex = new RegExp(escapeRegExp(oldValue), 'g');
                if (regex.test(fileContent)) {
                    fileContent = fileContent.replace(regex, newValue);
                    fileUpdated = true;
                }
            }
        }

        if (fileUpdated) {
            fs.writeFileSync(filePath, fileContent, 'utf8');
            console.log(`  ✔ Updated: ${path.basename(filePath)}`);
        }
    }

    // 5. Update state path to reflect current state
    fs.writeFileSync(statePath, JSON.stringify(currentConfig, null, 2), 'utf8');
    console.log("✔ Saved new state to attenmo-config-state.json.");
}

// 6. Always run update-kb.js to ensure the chatbot's knowledgeBase.js is synchronized
console.log("🤖 Running update-kb.js to synchronize support chatbot knowledge base...");
try {
    const kbScriptPath = path.join(__dirname, 'update-kb.js');
    const output = execSync(`node "${kbScriptPath}"`, { encoding: 'utf8' });
    console.log(output.trim());
} catch (error) {
    console.error("❌ Failed to run update-kb.js:", error.message);
    process.exit(1);
}
