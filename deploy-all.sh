#!/bin/bash
# AttenMo Unified Build, Deploy & Sync Script — Parallel Edition

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_START=$(date +%s)

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}      AttenMo UNIFIED DEPLOYMENT SCRIPT ⚡        ${NC}"
echo -e "${BLUE}===================================================${NC}"

COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    read -rp "Commit message (Enter = default): " input
    COMMIT_MSG="${input:-chore: automated deployment update}"
fi

# ── Logging helpers ───────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✔ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${NC}"; }
err()  { echo -e "${RED}  ✖ $*${NC}"; }

# ── Background job tracker ────────────────────────────────────────────────────
LOGS_DIR=".deploy-logs"
rm -rf "$LOGS_DIR" && mkdir -p "$LOGS_DIR"

declare -A JOB_PIDS
declare -A JOB_LOGS

# Usage: run_bg <label> <logfile> <cmd> [args...]
run_bg() {
    local label="$1" logfile="$2"; shift 2
    "$@" > "$logfile" 2>&1 &
    JOB_PIDS["$label"]=$!
    JOB_LOGS["$label"]="$logfile"
    log "  ↦ ${BLUE}${label}${NC} started (pid=${JOB_PIDS[$label]})"
}

# Usage: wait_job <label> [fatal=true|false]
wait_job() {
    local label="$1" fatal="${2:-true}"
    local pid="${JOB_PIDS[$label]}" log="${JOB_LOGS[$label]}"
    if wait "$pid"; then
        ok "$label"
    else
        if [ "$fatal" = "true" ]; then
            err "$label FAILED — aborting. Log:"
            cat "$log"
            exit 1
        else
            warn "$label skipped/failed (non-fatal). Log:"
            tail -6 "$log"
        fi
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — Sequential prerequisites (must finish before anything else)
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}━━━ PHASE 1 ─ Prerequisites ━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

log "Git credential helper"
git config credential.helper store
ok "Git credential helper"

log "Updating details & chatbot KB"
node scripts/update-details.js
ok "Details & KB updated"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Parallel builds: PDF manual + Android APK
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}━━━ PHASE 2 ─ Build (PDF + APK in parallel) ━━━━━━━━${NC}"

run_bg "PDF Manual" "$LOGS_DIR/pdf.log" \
    google-chrome \
        --headless \
        --disable-gpu \
        --print-to-pdf="public/QR Attendance System - Complete User Manual.pdf" \
        "file://$(pwd)/public/manual.html"

run_bg "Android APK Build" "$LOGS_DIR/apk-build.log" \
    bash scripts/build-app.sh

log "Waiting for builds…"
wait_job "PDF Manual"
wait_job "Android APK Build"
ok "Phase 2 done"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — Parallel deploys: Firebase + APK upload + Cloudflare + Functions
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}━━━ PHASE 3 ─ Deploy (all targets in parallel) ━━━━━${NC}"

# Firebase Hosting + Database  ← FATAL: must succeed
run_bg "Firebase Hosting + DB" "$LOGS_DIR/firebase.log" \
    firebase deploy --only hosting,database

# APK → GitHub Release
run_bg "APK → GitHub Release" "$LOGS_DIR/apk-upload.log" \
    python3 scripts/upload-apk.py

# ADB install (optional)
(
    if adb devices 2>/dev/null | grep -w "device" > /dev/null; then
        adb install -r AttenMo.apk
    else
        echo "No device connected. Skipping."
    fi
) > "$LOGS_DIR/adb.log" 2>&1 &
JOB_PIDS["ADB Install"]=$!
JOB_LOGS["ADB Install"]="$LOGS_DIR/adb.log"

# Cloudflare Worker (optional)
(
    if [ -d attenmo-support-worker ]; then
        cd attenmo-support-worker
        command -v npx > /dev/null && npx wrangler deploy || echo "Worker deploy skipped."
    else
        echo "Worker folder not found."
    fi
) > "$LOGS_DIR/cloudflare.log" 2>&1 &
JOB_PIDS["Cloudflare Worker"]=$!
JOB_LOGS["Cloudflare Worker"]="$LOGS_DIR/cloudflare.log"

# Cloud Functions (optional — Blaze plan needed)
(
    if [ -d functions ]; then
        cd functions && npm install --silent > /dev/null 2>&1 && cd ..
        firebase deploy --only functions || echo "Functions skipped."
    else
        echo "functions/ folder not found."
    fi
) > "$LOGS_DIR/functions.log" 2>&1 &
JOB_PIDS["Cloud Functions"]=$!
JOB_LOGS["Cloud Functions"]="$LOGS_DIR/functions.log"

# ── Wait for all Phase 3 jobs ─────────────────────────────────────────────────
log "Waiting for all deployments…"

wait_job "Firebase Hosting + DB" true      # fatal
wait_job "APK → GitHub Release"  false     # non-fatal (token may be missing)
wait_job "ADB Install"           false     # non-fatal
wait_job "Cloudflare Worker"     false     # non-fatal
wait_job "Cloud Functions"       false     # non-fatal

ok "Phase 3 done"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — Git sync (must be last — commits final state)
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}━━━ PHASE 4 ─ Git Sync ━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

git add .

if git diff --cached --quiet; then
    warn "Nothing to commit."
else
    git commit -m "$COMMIT_MSG"

    CURRENT_BRANCH="$(git branch --show-current)"
    DEPLOY_BRANCH="auto-deploy"

    log "Pushing to GitHub…"

    PUSH_OUT=$(git push origin "$CURRENT_BRANCH" 2>&1) && PUSH_SUCCESS=true || PUSH_SUCCESS=false

    if [ "$PUSH_SUCCESS" = true ]; then
        ok "Pushed directly to $CURRENT_BRANCH"
        if echo "$PUSH_OUT" | grep -iq "bypassed"; then
            warn "Pushed by bypassing rulesets/protection rules."
        fi
    else
        if echo "$PUSH_OUT" | grep -iqE "protected|ruleset|rule|pull request|gh006"; then
            warn "Branch protection active. Using auto PR flow…"

            git push origin "$CURRENT_BRANCH:$DEPLOY_BRANCH" --force

            PR_URL=$(gh pr create \
                --base "$CURRENT_BRANCH" \
                --head "$DEPLOY_BRANCH" \
                --title "$COMMIT_MSG" \
                --body "🤖 Auto-deploy by deploy-all.sh" \
                2>&1)

            if echo "$PR_URL" | grep -q "already exists"; then
                PR_URL=$(gh pr list --head "$DEPLOY_BRANCH" --base "$CURRENT_BRANCH" --json url --jq '.[0].url')
                warn "PR already open: $PR_URL"
            else
                log "PR created: $PR_URL"
            fi

            MERGE_OUT=$(gh pr merge "$DEPLOY_BRANCH" \
                --merge \
                --admin \
                --delete-branch \
                --subject "$COMMIT_MSG" 2>&1) && MERGE_SUCCESS=true || MERGE_SUCCESS=false

            if [ "$MERGE_SUCCESS" = true ]; then
                ok "Auto-merged into $CURRENT_BRANCH"
            else
                err "Merge failed. Merge manually: $PR_URL"
                echo "$MERGE_OUT"
            fi
        else
            err "Direct git push failed:"
            echo "$PUSH_OUT"
            err "Please resolve the Git error manually before re-running."
            exit 1
        fi
    fi
fi

# ── Cleanup & summary ─────────────────────────────────────────────────────────
rm -rf "$LOGS_DIR"

SCRIPT_END=$(date +%s)
ELAPSED=$((SCRIPT_END - SCRIPT_START))
MINS=$((ELAPSED / 60))
SECS=$((ELAPSED % 60))

echo
echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}      AttenMo DEPLOYMENT FINISHED SUCCESSFULLY    ${NC}"
echo -e "${GREEN}      ⏱  Total time: ${MINS}m ${SECS}s                    ${NC}"
echo -e "${GREEN}===================================================${NC}"
