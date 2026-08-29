import React from 'react';
import { AppLayout } from './AppLayout';

interface FinanceiroLayoutProps {
  children: React.ReactNode;
}

export const FinanceiroLayout = ({ children }: FinanceiroLayoutProps) => {
  return <AppLayout>{children}</AppLayout>;
};

export default FinanceiroLayout;
