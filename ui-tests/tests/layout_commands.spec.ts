import { expect, test } from '@jupyterlab/galata';
import { executeCommand } from './utils/commands';

const COMMANDS = {
  reposition: 'jupyterlab-ai-commands:reposition',
  createNotebook: 'jupyterlab-ai-commands:create-notebook'
} as const;

async function getWidgetIdByPath(
  page: any,
  path: string
): Promise<string | undefined> {
  return page.evaluate(async (notebookPath: string) => {
    await window.jupyterapp.started;
    const widgets = Array.from(window.jupyterapp.shell.widgets('main'));
    return (widgets.find((w: any) => w.context?.path === notebookPath) as any)
      ?.id;
  }, path);
}

test.describe('Layout Commands', () => {
  test.use({ serverFiles: 'only-on-failure' });

  test('should silently do nothing when no widget is found', async ({
    page
  }) => {
    // Use a widget ID that does not exist and has no current widget fallback
    // by evaluating directly so no widget will be returned.
    const result = await page.evaluate(async () => {
      await window.jupyterapp.started;
      return window.jupyterapp.commands.execute(
        'jupyterlab-ai-commands:reposition',
        { widgetId: '__non_existent_widget_id__', mode: 'split-right' }
      );
    });
    // Command returns undefined and does not throw.
    expect(result).toBeUndefined();
  });

  test('should split the active widget to the right', async ({
    page,
    tmpPath
  }) => {
    const notebookPath = `${tmpPath}/test-split-right.ipynb`;
    await executeCommand(page, COMMANDS.createNotebook, {
      name: notebookPath,
      language: 'python'
    });

    const tabBarsBefore = await page.locator('.lm-DockPanel-tabBar').count();

    await executeCommand(page, COMMANDS.reposition, { mode: 'split-right' });

    await expect(page.locator('.lm-DockPanel-tabBar')).toHaveCount(
      tabBarsBefore + 1
    );
  });

  test('should split a specific widget by ID to the left', async ({
    page,
    tmpPath
  }) => {
    const notebook1 = `${tmpPath}/reposition-nb1.ipynb`;
    const notebook2 = `${tmpPath}/reposition-nb2.ipynb`;

    await executeCommand(page, COMMANDS.createNotebook, {
      name: notebook1,
      language: 'python'
    });
    await executeCommand(page, COMMANDS.createNotebook, {
      name: notebook2,
      language: 'python'
    });

    const widgetId = await getWidgetIdByPath(page, notebook1);
    expect(widgetId).toBeTruthy();

    const tabBarsBefore = await page.locator('.lm-DockPanel-tabBar').count();

    await executeCommand(page, COMMANDS.reposition, {
      widgetId,
      mode: 'split-left'
    });

    await expect(page.locator('.lm-DockPanel-tabBar')).toHaveCount(
      tabBarsBefore + 1
    );
  });

  test('should move a widget to the right sidebar area', async ({
    page,
    tmpPath
  }) => {
    const notebookPath = `${tmpPath}/test-move-to-right.ipynb`;
    await executeCommand(page, COMMANDS.createNotebook, {
      name: notebookPath,
      language: 'python'
    });

    const widgetId = await getWidgetIdByPath(page, notebookPath);
    expect(widgetId).toBeTruthy();

    await executeCommand(page, COMMANDS.reposition, {
      widgetId,
      area: 'right'
    });

    // The widget should now be in the right sidebar.
    await expect(page.sidebar.getContentPanelLocator('right')).toContainText(
      'test-move-to-right'
    );
  });
});
