import React from 'react';
import { AppLayout } from './AppLayout';

interface MensalidadesLayoutProps {
  children: React.ReactNode;
}

export const MensalidadesLayout = ({ children }: MensalidadesLayoutProps) => {
  return <AppLayout>{children}</AppLayout>;
};

export default MensalidadesLayout;
