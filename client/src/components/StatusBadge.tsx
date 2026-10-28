import React from 'react';

interface Props {
  status: string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const normalized = status.toLowerCase();
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`badge badge-${normalized}`}>
      {label}
    </span>
  );
};
