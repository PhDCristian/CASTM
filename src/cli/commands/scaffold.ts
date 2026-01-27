/**
 * Scaffolding Commands - init and new
 * 
 * Commands for creating new projects and kernels from templates.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  PROJECT_TEMPLATES,
  KERNEL_TEMPLATES,
  getProjectTemplate,
  getKernelTemplate,
  getProjectTemplateNames,
  getKernelTemplateNames,
  applyTemplateVariables,
} from '../templates/index.js';
import { getCurrentTheme } from '../config/store.js';

/**
 * Init command - create a new project
 */
export const initCommand = new Command('init')
  .description('Initialize a new OpenEdge DSL project')
  .argument('[name]', 'Project name (defaults to current directory name)')
  .option('-t, --template <template>', 'Project template (basic, advanced, zkp)', 'basic')
  .option('-f, --force', 'Overwrite existing files')
  .option('--list', 'List available templates')
  .action(async (name: string | undefined, options: { 
    template: string; 
    force?: boolean;
    list?: boolean;
  }) => {
    const theme = getCurrentTheme();
    
    // List templates
    if (options.list) {
      console.log();
      console.log(chalk.hex(theme.primary)('  Available project templates:'));
      console.log();
      for (const [key, template] of Object.entries(PROJECT_TEMPLATES)) {
        console.log(`  ${chalk.hex(theme.accent)(key.padEnd(12))} ${chalk.dim(template.description)}`);
      }
      console.log();
      return;
    }

    const projectName = name || basename(process.cwd());
    const projectDir = name ? join(process.cwd(), name) : process.cwd();
    
    // Get template
    const template = getProjectTemplate(options.template);
    if (!template) {
      console.log();
      console.log(chalk.hex(theme.error)(`  ✗ Unknown template: ${options.template}`));
      console.log(chalk.dim(`    Available: ${getProjectTemplateNames().join(', ')}`));
      console.log();
      return;
    }

    console.log();
    console.log(chalk.hex(theme.primary)('  ● init'));
    console.log();
    console.log(`  ${chalk.dim('project')}  ${chalk.white(projectName)}`);
    console.log(`  ${chalk.dim('template')} ${chalk.hex(theme.accent)(template.name)}`);
    console.log(`  ${chalk.dim('path')}     ${chalk.white(projectDir)}`);
    console.log();

    // Create project directory if needed
    if (name && !existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
      console.log(`  ${chalk.green('+')} Created ${chalk.dim(name + '/')}`);
    }

    // Create files
    let created = 0;
    let skipped = 0;

    for (const file of template.files) {
      const filePath = join(projectDir, file.path);
      const fileDir = dirname(filePath);

      // Check if file exists
      if (existsSync(filePath) && !options.force) {
        console.log(`  ${chalk.yellow('○')} Skipped ${chalk.dim(file.path)} (exists)`);
        skipped++;
        continue;
      }

      // Create directory if needed
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      // Apply variables
      const content = applyTemplateVariables(file.content, {
        NAME: projectName,
        PROJECT_NAME: projectName,
      });

      // Write file
      writeFileSync(filePath, content);
      console.log(`  ${chalk.green('+')} Created ${chalk.dim(file.path)}`);
      created++;
    }

    console.log();
    console.log(`  ${chalk.hex(theme.success)('✓')} Initialized ${chalk.white(projectName)}`);
    console.log(`    ${chalk.dim(`${created} files created, ${skipped} skipped`)}`);
    console.log();
    console.log(chalk.dim('  Next steps:'));
    if (name) {
      console.log(chalk.dim(`    cd ${name}`));
    }
    console.log(chalk.dim('    openedge compile src/main.dsl'));
    console.log(chalk.dim('    openedge tui'));
    console.log();
  });

/**
 * New command - create a new kernel from template
 */
export const newCommand = new Command('new')
  .description('Create a new kernel from template')
  .argument('<type>', 'What to create: kernel')
  .argument('[name]', 'Name for the new item')
  .option('-t, --template <template>', 'Template to use', 'simple')
  .option('-o, --output <path>', 'Output path')
  .option('--list', 'List available templates')
  .action(async (type: string, name: string | undefined, options: {
    template: string;
    output?: string;
    list?: boolean;
  }) => {
    const theme = getCurrentTheme();

    if (type !== 'kernel') {
      console.log();
      console.log(chalk.hex(theme.error)(`  ✗ Unknown type: ${type}`));
      console.log(chalk.dim('    Supported: kernel'));
      console.log();
      return;
    }

    // List templates
    if (options.list) {
      console.log();
      console.log(chalk.hex(theme.primary)('  Available kernel templates:'));
      console.log();
      for (const [key, template] of Object.entries(KERNEL_TEMPLATES)) {
        console.log(`  ${chalk.hex(theme.accent)(key.padEnd(12))} ${chalk.dim(template.description)}`);
      }
      console.log();
      return;
    }

    const kernelName = name || 'MyKernel';
    const template = getKernelTemplate(options.template);

    if (!template) {
      console.log();
      console.log(chalk.hex(theme.error)(`  ✗ Unknown template: ${options.template}`));
      console.log(chalk.dim(`    Available: ${getKernelTemplateNames().join(', ')}`));
      console.log();
      return;
    }

    // Determine output path
    const fileName = `${kernelName.toLowerCase().replace(/\s+/g, '_')}.dsl`;
    const outputPath = options.output || join('src', fileName);
    const outputDir = dirname(outputPath);

    console.log();
    console.log(chalk.hex(theme.primary)('  ● new kernel'));
    console.log();
    console.log(`  ${chalk.dim('name')}     ${chalk.white(kernelName)}`);
    console.log(`  ${chalk.dim('template')} ${chalk.hex(theme.accent)(template.name)}`);
    console.log(`  ${chalk.dim('output')}   ${chalk.white(outputPath)}`);
    console.log();

    // Create directory if needed
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
      console.log(`  ${chalk.green('+')} Created ${chalk.dim(outputDir + '/')}`);
    }

    // Check if file exists
    if (existsSync(outputPath)) {
      console.log(`  ${chalk.hex(theme.error)('✗')} File already exists: ${outputPath}`);
      console.log(chalk.dim('    Use a different name or delete the existing file'));
      console.log();
      return;
    }

    // Apply variables and write
    const content = applyTemplateVariables(template.content, {
      NAME: kernelName,
    });

    writeFileSync(outputPath, content);
    console.log(`  ${chalk.green('+')} Created ${chalk.dim(outputPath)}`);

    console.log();
    console.log(`  ${chalk.hex(theme.success)('✓')} Created kernel ${chalk.white(kernelName)}`);
    console.log();
    console.log(chalk.dim('  Next steps:'));
    console.log(chalk.dim(`    openedge compile ${outputPath}`));
    console.log(chalk.dim(`    openedge watch ${outputPath} -dm`));
    console.log();
  });
