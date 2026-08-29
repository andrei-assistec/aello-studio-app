import React from 'react';
import { AppLayout } from './AppLayout';

interface AgendaLayoutProps {
  children: React.ReactNode;
}

export const AgendaLayout = ({ children }: AgendaLayoutProps) => {
  return <AppLayout>{children}</AppLayout>;
};

export default AgendaLayout;
