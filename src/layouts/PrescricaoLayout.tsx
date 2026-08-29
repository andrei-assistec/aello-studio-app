import React from 'react';
import { AppLayout } from './AppLayout';

interface PrescricaoLayoutProps {
  children: React.ReactNode;
}

export const PrescricaoLayout = ({ children }: PrescricaoLayoutProps) => {
  return <AppLayout>{children}</AppLayout>;
};

export default PrescricaoLayout;
