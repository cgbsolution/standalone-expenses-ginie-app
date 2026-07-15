import React from 'react';
import { ToastHost, toast } from './Toast';
import { ConfirmHost, confirm } from './ConfirmDialog';
import { ActionSheetHost, actionSheet } from './ActionSheet';

export { toast, confirm, actionSheet };
export { tokens } from './tokens';

export function UIHosts() {
  return (
    <>
      <ToastHost />
      <ConfirmHost />
      <ActionSheetHost />
    </>
  );
}
