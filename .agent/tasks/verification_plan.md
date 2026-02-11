# Implementation Plan - Full End-to-End Verification & Fixes

This plan outlines the steps to verify and fix the end-to-end flow for both Agent Mode (LiveKit) and Direct Mode (WebSocket).

## 1. Fix Known Regressions

### 1.1 Python SDK Enum Correction
- **Issue**: `rtc.DataPacketKind.RELIABLE` causes an error in the current library version.
- **Action**: Correct the enum name to `rtc.DataPacketKind.KIND_RELIABLE` in `worker/main.py`.

### 1.2 Frontend Navigation Fix
- **Issue**: `navigate is not defined` error in `SessionPage` in `App.jsx`.
- **Action**: Ensure `useNavigate` is initialized within the `SessionPage` component.

## 2. Structural Audit

### 2.1 Worker Process Health
- Ensure the `agent-bot` joins the room correctly and subscribes to audio.
- Ensure the `FastAPI` server for Direct Mode is reachable and handles Base64 chunks correctly.

### 2.2 Backend Node.js Server
- Verify `/token` endpoint provides the correct grants for the agent bot to join.
- Ensure no CORS issues prevent the frontend from reaching the backend on port 8080.

### 2.3 Client-Side Hooks
- **useLiveKit**: Verify `DataReceived` event correctly decodes the agent's packets.
- **useDirectStream**: Verify the async `connect` promise resolves properly and starts the recording phase.

## 3. Verification Steps

### 3.1 Trace Mode: Agent
- Start Worker -> Observe "Agent Bot: Connected".
- Join Session in Browser -> Observe "Agent Detected: true".
- Speak -> Check Worker logs for `Processing audio` and `📝 [AGENT]`.
- Frontend -> Check if text appears in the feed.

### 3.2 Trace Mode: Direct
- Select Direct Mode -> observe WS connection.
- Speak -> Check Worker logs for `Processing audio` and `📝 [DIRECT]`.
- Frontend -> Check if text appears in the feed.

## 4. Final Polish
- Cleanup any redundant console.logs.
- Ensure the "Neural Intelligence Feed" label is restored if desired.
- Verify "Total Destruction" on disconnect (killing mic and WS).
