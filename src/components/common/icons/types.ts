import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
  title?: string;
}

export const defaultIconProps = {
  size: 18,
  strokeWidth: 1.75,
} as const;
