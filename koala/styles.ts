import { CSSProperties } from 'react';
import { MantineTheme } from '@mantine/core';

// Text styles
export const textShadowStyle: CSSProperties = { 
  textShadow: '0 1px 2px rgba(0,0,0,0.1)' 
};

// Link styles
export const linkStyle = (theme: MantineTheme): CSSProperties => ({ 
  color: theme.colors.blue[6], 
  textDecoration: "none" 
});

// Layout styles
export const flexGrowStyle: CSSProperties = { 
  flexGrow: 1 
};

export const fullHeightStyle: CSSProperties = { 
  height: "100%" 
};
