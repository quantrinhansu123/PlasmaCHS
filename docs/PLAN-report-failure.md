# PLAN: Report Failure from Customer List

This plan outlines the steps to add a "Báo hỏng" (Report Failure) button to the customer list actions.

## 1. Context & Goal
The user wants to quickly report a machine failure directly from the customer list. This should open the existing `RepairTicketForm` with the customer already selected.

## 2. Proposed Changes

### RepairTicketForm Component
- **File**: `src/components/Repairs/RepairTicketForm.jsx`
- **Change**: Enhance to accept `initialCustomer` prop.
- **Logic**: If `initialCustomer` exists, skip manual selection and load their devices immediately.

### Customers Page
- **File**: `src/pages/Customers.jsx`
- **Change**: 
    - Add `Ticket` icon and `RepairTicketForm` component.
    - Add `isRepairModalOpen` state.
    - Insert "Báo hỏng" button in `Thao tác` column (Desktop) and Card actions (Mobile).
    - Trigger modal with the selected customer.

## 3. Task Breakdown
- [ ] Modify `RepairTicketForm.jsx` to handle `initialCustomer` prop.
- [ ] Update `Customers.jsx` UI and state logic.
- [ ] Test the integration flow.

## 4. Verification
- Open "Danh sách khách hàng".
- Click "Báo hỏng" on a customer.
- Form should open with customer Name/ID pre-filled.
- Choose machine -> Description -> Save.
- Check "Ticket sửa chữa" to see the new entry.
