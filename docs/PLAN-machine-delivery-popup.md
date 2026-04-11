# PLAN: Machine Delivery Popup

## Context
The user wants to implement a delivery confirmation workflow for "Máy" (Machine Requests) that mimics the existing "Bình" workflow.
The machine items should be rendered in the delivery confirmation form (section 1 checkbox list, section 2 photo upload, section 3 confirmation checkbox).
It must also include a "Xem phiếu đề xuất" (Preview Request Form) button that opens the `MachineIssueRequestForm` in a **popup** overlay inside the `OrderStatusUpdater` modal, without navigating away.

## Task Breakdown
1. **Identify Machine Requests:** Check if the order code starts with `DNXM-`.
2. **Show "Xem phiếu đề xuất" button:**
   - In `OrderStatusUpdater.jsx`, when `isDNXM` and status is `DANG_GIAO_HANG`, add a button above the delivery checklist.
3. **Render Popup:**
   - Create a new state `showPreviewPopup` in `OrderStatusUpdater.jsx`.
   - When the button is clicked, set `showPreviewPopup(true)`.
   - Render a modal overlay containing the `MachineIssueRequestForm` component. We might need to pass `viewOnly=true` and `orderId=order.id` (or the `MachineIssueRequestForm` might extract it from URL, wait! `MachineIssueRequestForm` uses `useLocation().search` to fetch the `orderId`. If it uses hooks that are URL-dependent, rendering it inside a popup without the URL parameters might not work out-of-the-box).

## Investigation Required for Popup Form
Let's see if `MachineIssueRequestForm` can accept props directly instead of relying solely on `useLocation`.
If not, I will need to either:
a) Add prop fallbacks to `MachineIssueRequestForm` (e.g., `const orderId = propsOrderId || queryParams.get('orderId');`).
b) Or render an `<iframe>` pointing to `/machine-issue?orderId=XXX&viewOnly=true` inside the popup. (Simplest and most isolated method but might be slow to load).

## Agent Assignments
- `frontend-specialist`: Implement the popup UI in `OrderStatusUpdater` and adjust `MachineIssueRequestForm` to support direct props for internal modal usage.

## Verification Checklist
- [ ] Add `Xem phiếu đề xuất` button in delivery form.
- [ ] Ensure button only shows for DNXM orders.
- [ ] Clicking button opens popup correctly.
- [ ] Inside popup, `MachineIssueRequestForm` fetches and displays correct data via view-only mode.
- [ ] Delivery checklist, photo upload, and confirmation sections work accurately for machine tracking.
