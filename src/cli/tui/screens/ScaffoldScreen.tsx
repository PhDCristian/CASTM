/**
 * ScaffoldScreen - TUI screen for project and kernel scaffolding
 * Interactive wizard with template selection and preview
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import * as path from 'path';
import * as fs from 'fs';
import { useTheme, symbols } from '../theme.js';
import { Panel } from '../components/Panel.js';
import { SelectList, SelectOption } from '../components/SelectList.js';
import { CodePreview } from '../components/CodePreview.js';
import { 
  PROJECT_TEMPLATES, 
  KERNEL_TEMPLATES, 
  generateProjectFiles, 
  generateKernelFile,
  getProjectTemplateList,
  getKernelTemplateList,
} from '../../templates/index.js';

interface ScaffoldScreenProps {
  onNavigate: (screen: any) => void;
}

type WizardStep = 'type' | 'template' | 'name' | 'confirm' | 'creating' | 'done';
type ScaffoldType = 'project' | 'kernel';

export function ScaffoldScreen({ onNavigate }: ScaffoldScreenProps) {
  const theme = useTheme();
  const [step, setStep] = useState<WizardStep>('type');
  const [scaffoldType, setScaffoldType] = useState<ScaffoldType>('project');
  const [templateId, setTemplateId] = useState<string>('basic');
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ success: boolean; files: string[]; error?: string } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<string>('basic');

  // Get template info
  const templates = scaffoldType === 'project' ? getProjectTemplateList() : getKernelTemplateList();
  const selectedTemplate = templates.find(t => t.id === templateId);

  // Type selection options
  const typeOptions: SelectOption<string>[] = [
    { label: `${symbols.folder} New Project`, value: 'project', description: 'Create a complete project structure' },
    { label: `${symbols.file} New Kernel`, value: 'kernel', description: 'Add a kernel file to current project' },
    { label: '─'.repeat(30), value: '__SEP__', disabled: true },
    { label: 'Back', value: 'back' },
  ];

  // Template selection options
  const templateOptions: SelectOption<string>[] = [
    ...templates.map(t => ({
      label: `${t.id === templateId ? '● ' : '  '}${t.name}`,
      value: t.id,
      description: t.description,
    })),
    { label: '─'.repeat(30), value: '__SEP__', disabled: true },
    { label: 'Back', value: 'back' },
  ];

  // Handle type selection
  const handleTypeSelect = (value: string) => {
    if (value === 'back') {
      onNavigate({ type: 'main' });
    } else if (value === 'project' || value === 'kernel') {
      setScaffoldType(value);
      setTemplateId(value === 'project' ? 'basic' : 'simple');
      setStep('template');
    }
  };

  // Handle template selection
  const handleTemplateSelect = (value: string) => {
    if (value === 'back') {
      setStep('type');
    } else if (value !== '__SEP__') {
      setTemplateId(value);
      setStep('name');
    }
  };

  // Handle creation
  const createScaffold = async () => {
    setStep('creating');
    
    try {
      if (scaffoldType === 'project') {
        const projectPath = path.resolve(process.cwd(), name);
        
        // Check if directory exists
        if (fs.existsSync(projectPath)) {
          setResult({ success: false, files: [], error: `Directory ${name} already exists` });
          setStep('done');
          return;
        }
        
        // Create project
        fs.mkdirSync(projectPath, { recursive: true });
        const files = generateProjectFiles(templateId, name);
        const createdFiles: string[] = [];
        
        for (const file of files) {
          const filePath = path.join(projectPath, file.path);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, file.content);
          createdFiles.push(file.path);
        }
        
        setResult({ success: true, files: createdFiles });
      } else {
        // Kernel creation
        const srcDir = fs.existsSync('src') ? 'src' : '.';
        const kernelPath = path.join(srcDir, `${name.toLowerCase()}.dsl`);
        
        if (fs.existsSync(kernelPath)) {
          setResult({ success: false, files: [], error: `File ${kernelPath} already exists` });
          setStep('done');
          return;
        }
        
        const content = generateKernelFile(templateId, name);
        fs.writeFileSync(kernelPath, content);
        
        setResult({ success: true, files: [kernelPath] });
      }
    } catch (e: any) {
      setResult({ success: false, files: [], error: e.message || 'Creation failed' });
    }
    
    setStep('done');
  };

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'type') {
        onNavigate({ type: 'main' });
      } else if (step === 'template') {
        setStep('type');
      } else if (step === 'name') {
        setStep('template');
      } else if (step === 'confirm') {
        setStep('name');
      } else if (step === 'done') {
        onNavigate({ type: 'main' });
      }
    }
    
    if (step === 'name' && key.return && name.trim()) {
      setStep('confirm');
    }
    
    if (step === 'confirm') {
      if (key.return) {
        createScaffold();
      }
    }
    
    if (step === 'done' && key.return) {
      onNavigate({ type: 'main' });
    }
  });

  // Get preview content
  const getPreviewContent = (): string => {
    if (scaffoldType === 'kernel') {
      return generateKernelFile(previewTemplate, 'Example');
    }
    const files = generateProjectFiles(previewTemplate, 'example');
    const mainFile = files.find(f => f.path.endsWith('.dsl'));
    return mainFile?.content || '// Preview not available';
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>{symbols.star} Create New</Text>
      </Box>

      {step === 'type' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.dim}>What would you like to create?</Text>
          </Box>
          <SelectList
            options={typeOptions}
            onSelect={handleTypeSelect}
            onEscape={() => onNavigate({ type: 'main' })}
          />
        </Box>
      )}

      {step === 'template' && (
        <Box flexDirection="row">
          <Box flexDirection="column" width={35} marginRight={2}>
            <Box marginBottom={1}>
              <Text color={theme.accent}>
                {scaffoldType === 'project' ? 'Project' : 'Kernel'} Template
              </Text>
            </Box>
            <SelectList
              options={templateOptions}
              onSelect={handleTemplateSelect}
              onHighlight={(value) => {
                if (value !== '__SEP__' && value !== 'back') {
                  setPreviewTemplate(value);
                }
              }}
              onEscape={() => setStep('type')}
            />
          </Box>
          
          <Box flexDirection="column" flexGrow={1}>
            <Text color={theme.dim} marginBottom={1}>Preview:</Text>
            <CodePreview 
              code={getPreviewContent()} 
              maxLines={15}
            />
          </Box>
        </Box>
      )}

      {step === 'name' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.dim}>
              {scaffoldType === 'project' ? 'Project' : 'Kernel'} name:
            </Text>
          </Box>
          
          <Box borderStyle="round" borderColor={theme.primary} paddingX={1} marginBottom={1}>
            <TextInput
              value={name}
              onChange={setName}
              placeholder={scaffoldType === 'project' ? 'my-project' : 'MyKernel'}
            />
          </Box>
          
          <Box marginTop={1}>
            <Text color={theme.dim}>Template: </Text>
            <Text color={theme.accent}>{selectedTemplate?.name}</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text color={theme.dim}>Press Enter to continue • Esc to go back</Text>
          </Box>
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Panel title="Confirm Creation" borderColor={theme.primary}>
            <Box flexDirection="column">
              <Box>
                <Text color={theme.dim}>{'Type:     '.padEnd(12)}</Text>
                <Text>{scaffoldType === 'project' ? 'Project' : 'Kernel'}</Text>
              </Box>
              <Box>
                <Text color={theme.dim}>{'Name:     '.padEnd(12)}</Text>
                <Text color={theme.primary} bold>{name}</Text>
              </Box>
              <Box>
                <Text color={theme.dim}>{'Template: '.padEnd(12)}</Text>
                <Text>{selectedTemplate?.name}</Text>
              </Box>
              {scaffoldType === 'project' && (
                <Box>
                  <Text color={theme.dim}>{'Path:     '.padEnd(12)}</Text>
                  <Text color={theme.accent}>./{name}/</Text>
                </Box>
              )}
            </Box>
          </Panel>
          
          <Box marginTop={1}>
            <Text color={theme.success}>Press Enter to create • </Text>
            <Text color={theme.dim}>Esc to go back</Text>
          </Box>
        </Box>
      )}

      {step === 'creating' && (
        <Box>
          <Text color={theme.warning}>{symbols.info} Creating files...</Text>
        </Box>
      )}

      {step === 'done' && result && (
        <Box flexDirection="column">
          {result.success ? (
            <>
              <Panel title="Created Successfully" borderColor={theme.success}>
                <Box flexDirection="column">
                  <Box marginBottom={1}>
                    <Text color={theme.success}>{symbols.success} </Text>
                    <Text>Created {scaffoldType === 'project' ? 'project' : 'kernel'}: </Text>
                    <Text color={theme.primary} bold>{name}</Text>
                  </Box>
                  
                  <Text color={theme.dim} marginBottom={1}>Files created:</Text>
                  {result.files.map((f, i) => (
                    <Box key={i} marginLeft={2}>
                      <Text color={theme.success}>+ </Text>
                      <Text color={theme.dim}>{f}</Text>
                    </Box>
                  ))}
                </Box>
              </Panel>
              
              {scaffoldType === 'project' && (
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.accent}>Next steps:</Text>
                  <Text color={theme.dim}>  cd {name}</Text>
                  <Text color={theme.dim}>  openedge compile src/main.dsl</Text>
                  <Text color={theme.dim}>  openedge tui</Text>
                </Box>
              )}
            </>
          ) : (
            <Panel title="Creation Failed" borderColor={theme.error}>
              <Text color={theme.error}>{symbols.error} {result.error}</Text>
            </Panel>
          )}
          
          <Box marginTop={1}>
            <Text color={theme.dim}>Press Enter to continue</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
