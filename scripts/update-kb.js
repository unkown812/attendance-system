const fs = require('fs');
const path = require('path');

// Paths (relative to scripts/ directory)
const manualPath = path.join(__dirname, '..', 'public', 'manual.html');
const kbPath = path.join(__dirname, '..', 'attenmo-support-chatbot', 'src', 'knowledgeBase.js');

// 1. Static/Essential Creator and System Information (Highest Priority)
let kbContent = `
# AttenMo AI Customer Support Knowledge Base

Generated automatically from the repository manual and documentation.

## Creator & Developer Information

- **Creator & Developer**: **Shivam Kumar Mahto**
- **Creator Role**: Sole Creator, Developer, and Maintainer of the AttenMo application.
- **Creator Details**: Shivam Kumar Mahto is the developer who created AttenMo to digitize and automate student attendance tracking using QR codes and geofencing. He designed, implemented, and built the entire application using HTML5, CSS3, vanilla JavaScript, and Google Firebase.
- **Contact Channels**:
  - **Email**: attenmo.tech@gmail.com
  - **WhatsApp Community**: https://chat.whatsapp.com/GDOjvKK7nxGFvQ7NSrQNiG
  - **Instagram**: https://www.instagram.com/theattenmo/ (@theattenmo)
  - **LinkedIn**: https://www.linkedin.com/in/shivam-kumar-mahto-046228361/
- **Crucial Rule**: When asked "who created this app?", "who built this?", "developer contact", or "owner details", you MUST proudly mention **Shivam Kumar Mahto** and provide his contact details (email, WhatsApp Community, Instagram, and LinkedIn).

## Product & System Overview

AttenMo is a high-performance, Firebase-powered web and mobile application for QR-based student attendance.
- **Host Web URL**: \`https://attenmo.web.app\`
- **Database Backend**: Firebase Realtime Database.
- **Authentication**: Firebase Authentication (Google OAuth & Firebase Phone Auth).
- **PWA Capabilities**: Service worker handling offline assets and caching.
- **Mobile Environment**: Capacitor-wrapped native Android APK (~5 MB download size) containing native notifications and hardware-level mock location checks.

---
`;

// Helper to clean HTML text and format inline markdown
function htmlToMarkdown(html) {
    if (!html) return '';
    let md = html;
    
    // Replace inline formatting
    md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
    md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    
    // Convert links
    md = md.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Strip other HTML tags but keep text
    md = md.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    md = md.replace(/&amp;/g, '&')
           .replace(/&lt;/g, '<')
           .replace(/&gt;/g, '>')
           .replace(/&nbsp;/g, ' ')
           .replace(/&rarr;/g, '->')
           .replace(/&deg;/g, '°')
           .replace(/&times;/g, 'x')
           .replace(/&quot;/g, '"')
           .replace(/&#39;/g, "'");

    // Clean up excessive whitespace/newlines
    return md.replace(/\s+/g, ' ').trim();
}

function extractSectionBody(part) {
    let startIndex = part.indexOf('>');
    if (startIndex === -1) return '';
    let content = part.substring(startIndex + 1);
    
    // Track nested divs to find matching closing div
    let openDivs = 1;
    let index = 0;
    
    while (openDivs > 0 && index < content.length) {
        let nextOpen = content.indexOf('<div', index);
        let nextClose = content.indexOf('</div', index);
        
        if (nextClose === -1) {
            break; // malformed HTML fallback
        }
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
            openDivs++;
            index = nextOpen + 4;
        } else {
            openDivs--;
            index = nextClose + 5;
        }
    }
    
    return content.substring(0, index - 6);
}

// 2. Parse manual.html
if (fs.existsSync(manualPath)) {
    const htmlContent = fs.readFileSync(manualPath, 'utf8');
    
    const parts = htmlContent.split('<div class="section"');
    kbContent += "\n## System Features & User Manual (Official Documentation)\n";
    
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        
        // Extract section ID
        const idEnd = part.indexOf('"');
        const sectionId = part.substring(4, idEnd); // skip ' id="'
        
        const sectionHtml = extractSectionBody(part);
        
        // Extract Title
        const titleMatch = /<div class="section-title">([\s\S]*?)<\/div>/i.exec(sectionHtml);
        const title = titleMatch ? titleMatch[1].trim() : sectionId;
        
        // Extract Icon
        const iconMatch = /<span class="section-icon">([\s\S]*?)<\/span>/i.exec(sectionHtml);
        const icon = iconMatch ? iconMatch[1].trim() + " " : "";
        
        // Extract Badge/Role
        const badgeMatch = /<span class="section-badge[^"]*">([\s\S]*?)<\/span>/i.exec(sectionHtml);
        const badge = badgeMatch ? ` (${badgeMatch[1].trim()})` : "";
        
        kbContent += `\n### ${icon}${title}${badge}\n\n`;
        
        // Split section by lines for item-by-item parsing
        const lines = sectionHtml.split('\n');
        let stepCount = 1;
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // 1. Process Steps
            if (line.includes('class="step"')) {
                const stepTextMatch = /<span class="step-text">([\s\S]*?)<\/span>/i.exec(line) || /<div class="step-text">([\s\S]*?)<\/div>/i.exec(line);
                if (stepTextMatch) {
                    kbContent += `${stepCount}. ${htmlToMarkdown(stepTextMatch[1])}\n`;
                    stepCount++;
                }
            }
            // 2. Process Bullet Lists
            else if (line.includes('<li>')) {
                const liMatch = /<li>([\s\S]*?)<\/li>/i.exec(line);
                if (liMatch) {
                    kbContent += `- ${htmlToMarkdown(liMatch[1])}\n`;
                }
            }
            // 3. Process Sub-Headers / Labels
            else if (line.includes('class="steps-label"')) {
                const labelMatch = /<div class="steps-label">([\s\S]*?)<\/div>/i.exec(line);
                if (labelMatch) {
                    kbContent += `\n#### ${htmlToMarkdown(labelMatch[1])}\n\n`;
                }
            }
        }
        
        // 4. Process Feature Cards
        if (sectionHtml.includes('feature-card')) {
            const cardRegex = /<div class="feature-card">([\s\S]*?)<\/div>/gi;
            let cardMatch;
            while ((cardMatch = cardRegex.exec(sectionHtml)) !== null) {
                const cardHtml = cardMatch[1];
                const cardTitleMatch = /<div class="fc-title">([\s\S]*?)<\/div>/i.exec(cardHtml);
                const cardDescMatch = /<div class="fc-desc">([\s\S]*?)<\/div>/i.exec(cardHtml);
                const cardIconMatch = /<div class="fc-icon">([\s\S]*?)<\/div>/i.exec(cardHtml);
                if (cardTitleMatch && cardDescMatch) {
                    const cardIcon = cardIconMatch ? cardIconMatch[1].trim() + " " : "";
                    kbContent += `- **${cardIcon}${htmlToMarkdown(cardTitleMatch[1])}**: ${htmlToMarkdown(cardDescMatch[1])}\n`;
                }
            }
        }

        // 5. Process Info/Warning/Danger boxes
        if (sectionHtml.includes('class="info-box')) {
            const boxRegex = /<div class="info-box\s+([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
            let boxMatch;
            while ((boxMatch = boxRegex.exec(sectionHtml)) !== null) {
                const boxClass = boxMatch[1]; // e.g. "tip" / "warning" / "danger"
                const boxContent = boxMatch[2];
                const spans = [...boxContent.matchAll(/<span>([\s\S]*?)<\/span>/gi)];
                if (spans.length >= 2) {
                    const icon = htmlToMarkdown(spans[0][1]);
                    const text = htmlToMarkdown(spans[1][1]);
                    const type = boxClass.includes('tip') ? 'TIP' : (boxClass.includes('warning') ? 'WARNING' : 'DANGER');
                    kbContent += `\n> **[${type}]** ${icon} ${text}\n\n`;
                }
            }
        }
    }
    
    // 6. Parse Danger Zone (if present)
    const dangerRegex = /<div class="danger-zone">([\s\S]*?)<\/div>/i.exec(htmlContent);
    if (dangerRegex) {
        const dangerHtml = dangerRegex[1];
        const dangerTitleMatch = /<div class="dz-title">([\s\S]*?)<\/div>/i.exec(dangerHtml);
        const dangerTextMatch = /<p>([\s\S]*?)<\/p>/i.exec(dangerHtml);
        if (dangerTitleMatch && dangerTextMatch) {
            kbContent += `\n### ⚠️ ${dangerTitleMatch[1].trim()}\n\n`;
            kbContent += `${htmlToMarkdown(dangerTextMatch[1])}\n`;
        }
    }
}

// 3. Export as ES module format
const finalJsContent = `export default \`\n${kbContent.trim().replace(/`/g, '\\`').replace(/\${/g, '\\${')}\n\`;\n`;

fs.writeFileSync(kbPath, finalJsContent, 'utf8');
console.log("✔ Knowledge base (knowledgeBase.js) regenerated successfully!");
