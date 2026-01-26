/**
 * Spinner Component - Modern animated loading indicators
 * Vercel/Next.js style with multiple animation types
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { spinnerFrames, timing, premiumColors, symbols } from '../theme.js';

type SpinnerType = 'dots' | 'line' | 'bounce' | 'grow' | 'pulse';

interface SpinnerProps {
  type?: SpinnerType;
  label?: string;
  color?: string;
  speed?: number;
}

export function Spinner({ 
  type = 'dots', 
  label, 
  color = premiumColors.accentCyan,
  speed = timing.spinnerInterval
}: SpinnerProps) {
  const frames = spinnerFrames[type] || spinnerFrames.dots;
  const [frameIndex, setFrameIndex] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, speed);
    
    return () => clearInterval(timer);
  }, [frames.length, speed]);
  
  return (
    <Box>
      <Text color={color}>{frames[frameIndex]}</Text>
      {label && <Text color={premiumColors.textMuted}> {label}</Text>}
    </Box>
  );
}

// Progress bar with smooth animation
interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;
  showPercent?: boolean;
  color?: string;
  emptyColor?: string;
  style?: 'block' | 'line' | 'dot';
  label?: string;
}

export function ProgressBar({
  progress,
  width = 20,
  showPercent = true,
  color = premiumColors.accentCyan,
  emptyColor = premiumColors.borderDim,
  style = 'block',
  label,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = width - filled;
  
  const chars = {
    block: { filled: '█', empty: '░' },
    line: { filled: '━', empty: '─' },
    dot: { filled: '●', empty: '○' },
  };
  
  const { filled: filledChar, empty: emptyChar } = chars[style] || chars.block;
  
  // Color gradient based on progress
  let progressColor = color;
  if (clampedProgress >= 75) progressColor = premiumColors.statusSuccess;
  else if (clampedProgress >= 50) progressColor = premiumColors.accentCyan;
  else if (clampedProgress >= 25) progressColor = premiumColors.statusWarning;
  else if (clampedProgress > 0) progressColor = premiumColors.statusError;
  
  return (
    <Box>
      {label && <Text color={premiumColors.textMuted}>{label} </Text>}
      <Text color={progressColor}>{filledChar.repeat(filled)}</Text>
      <Text color={emptyColor}>{emptyChar.repeat(empty)}</Text>
      {showPercent && (
        <Text color={progressColor} bold> {clampedProgress}%</Text>
      )}
    </Box>
  );
}

// Loading indicator with label
interface LoadingProps {
  label?: string;
  sublabel?: string;
}

export function Loading({ label = 'Loading', sublabel }: LoadingProps) {
  return (
    <Box flexDirection="column" alignItems="center">
      <Box>
        <Spinner type="dots" color={premiumColors.accentCyan} />
        <Text color={premiumColors.textBright}> {label}</Text>
      </Box>
      {sublabel && (
        <Text color={premiumColors.textDim}>{sublabel}</Text>
      )}
    </Box>
  );
}

// Compiling indicator (Vercel-style)
interface CompilingProps {
  file?: string;
  step?: string;
  progress?: number;
}

export function Compiling({ file, step, progress }: CompilingProps) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Spinner type="dots" color={premiumColors.accentPink} />
        <Text color={premiumColors.textBright} bold> Compiling</Text>
        {file && <Text color={premiumColors.textMuted}> {symbols.arrow} {file}</Text>}
      </Box>
      {step && (
        <Box marginLeft={2}>
          <Text color={premiumColors.textDim}>{symbols.tee} {step}</Text>
        </Box>
      )}
      {progress !== undefined && (
        <Box marginTop={1}>
          <ProgressBar progress={progress} width={30} style="block" />
        </Box>
      )}
    </Box>
  );
}

// Success indicator
interface SuccessProps {
  message: string;
  details?: string[];
  duration?: number;
}

export function Success({ message, details, duration }: SuccessProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={premiumColors.statusSuccess}>{symbols.success}</Text>
        <Text color={premiumColors.textBright} bold> {message}</Text>
        {duration !== undefined && (
          <Text color={premiumColors.textDim}> in {duration}ms</Text>
        )}
      </Box>
      {details && details.map((detail, i) => (
        <Box key={i} marginLeft={2}>
          <Text color={premiumColors.textMuted}>{symbols.tee} {detail}</Text>
        </Box>
      ))}
    </Box>
  );
}

// Error indicator
interface ErrorIndicatorProps {
  message: string;
  details?: string[];
  code?: string;
}

export function ErrorIndicator({ message, details, code }: ErrorIndicatorProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={premiumColors.statusError}>{symbols.error}</Text>
        <Text color={premiumColors.textBright} bold> {message}</Text>
        {code && (
          <Text color={premiumColors.statusError}> [{code}]</Text>
        )}
      </Box>
      {details && details.map((detail, i) => (
        <Box key={i} marginLeft={2}>
          <Text color={premiumColors.textMuted}>{symbols.tee} {detail}</Text>
        </Box>
      ))}
    </Box>
  );
}

// Step list (like Vercel deploy steps)
interface Step {
  label: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  duration?: number;
}

interface StepListProps {
  steps: Step[];
  title?: string;
}

export function StepList({ steps, title }: StepListProps) {
  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text color={premiumColors.textBright} bold>{title}</Text>
        </Box>
      )}
      {steps.map((step, i) => {
        let icon: React.ReactNode;
        let color = premiumColors.textMuted;
        
        switch (step.status) {
          case 'success':
            icon = <Text color={premiumColors.statusSuccess}>{symbols.success}</Text>;
            color = premiumColors.textNormal;
            break;
          case 'error':
            icon = <Text color={premiumColors.statusError}>{symbols.error}</Text>;
            color = premiumColors.statusError;
            break;
          case 'running':
            icon = <Spinner type="dots" color={premiumColors.accentCyan} />;
            color = premiumColors.textBright;
            break;
          case 'skipped':
            icon = <Text color={premiumColors.textDim}>○</Text>;
            color = premiumColors.textDim;
            break;
          default:
            icon = <Text color={premiumColors.textDim}>{symbols.pending}</Text>;
        }
        
        return (
          <Box key={i}>
            {icon}
            <Text color={color}> {step.label}</Text>
            {step.duration !== undefined && step.status === 'success' && (
              <Text color={premiumColors.textDim}> ({step.duration}ms)</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
