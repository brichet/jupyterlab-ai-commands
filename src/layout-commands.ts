import { ILabShell } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

/**
 *
 */
function registerRepositionWidgetCommand(
  commands: CommandRegistry,
  labShell: ILabShell
): void {
  const command = {
    id: 'jupyterlab-ai-commands:reposition',
    label: 'Reposition Widget',
    caption: 'Reposition a widget in the application shell',
    describedBy: {
      args: {
        type: 'object',
        properties: {
          widgetId: {
            type: 'string',
            description: 'The widget ID to reposition in the application shell'
          },
          area: {
            type: 'string',
            description: 'The name of the area to reposition the widget to'
          },
          mode: {
            type: 'string',
            enum: ['split-left', 'split-right', 'split-top', 'split-bottom'],
            description: 'The mode to use when repositioning the widget'
          }
        }
      }
    },
    execute: (args: any) => {
      const { widgetId, area, mode } = args;
      const widget = widgetId
        ? Array.from(labShell.widgets('main')).find(w => w.id === widgetId) ||
          labShell.currentWidget
        : labShell.currentWidget;

      if (!widget) {
        return;
      }

      if (area && area !== 'main') {
        // Move to different area
        labShell.move(widget, area);
        labShell.activateById(widget.id);
      } else if (mode) {
        // Reposition within main area using split mode
        labShell.add(widget, 'main', { mode, activate: true });
      }
    }
  };

  commands.addCommand(command.id, command);
}

/**
 * Options for registering layout commands
 */
export interface IRegisterLayoutCommandsOptions {
  commands: CommandRegistry;
  labShell?: ILabShell;
}

/**
 * Register all layout related commands
 */
export function registerLayoutCommands(
  options: IRegisterLayoutCommandsOptions
): void {
  const { commands, labShell } = options;

  if (labShell) {
    registerRepositionWidgetCommand(commands, labShell);
  }
}
