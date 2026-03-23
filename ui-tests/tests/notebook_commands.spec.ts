import type { IJupyterLabPageFixture } from '@jupyterlab/galata';
import { expect, test } from '@jupyterlab/galata';

const COMMANDS = {
  addCell: 'jupyterlab-ai-commands:add-cell',
  createNotebook: 'jupyterlab-ai-commands:create-notebook',
  deleteCell: 'jupyterlab-ai-commands:delete-cell',
  getCellInfo: 'jupyterlab-ai-commands:get-cell-info',
  getNotebookInfo: 'jupyterlab-ai-commands:get-notebook-info',
  runCell: 'jupyterlab-ai-commands:run-cell',
  saveNotebook: 'jupyterlab-ai-commands:save-notebook',
  setCellContent: 'jupyterlab-ai-commands:set-cell-content'
} as const;

async function executeCommand(
  page: IJupyterLabPageFixture,
  command: string,
  args: Record<string, unknown> = {}
): Promise<any> {
  return page.evaluate(
    async ({ args, command }) => {
      await window.jupyterapp.started;
      return await window.jupyterapp.commands.execute(command, args);
    },
    { args: { background: false, ...args }, command }
  );
}

test.describe('Notebook Commands', () => {
  test.use({ serverFiles: 'only-on-failure' });

  test('should create a notebook and add the expected cells', async ({
    page,
    tmpPath
  }) => {
    const notebookPath = `${tmpPath}/command-create-and-add.ipynb`;

    const createResult = await executeCommand(page, COMMANDS.createNotebook, {
      language: 'python',
      name: notebookPath
    });
    expect(createResult.success).toBe(true);

    await executeCommand(page, COMMANDS.addCell, {
      cellType: 'markdown',
      content: '# Title\nBody',
      notebookPath
    });
    await executeCommand(page, COMMANDS.addCell, {
      cellType: 'code',
      content: 'value = 41\nvalue + 1',
      notebookPath
    });

    const notebookInfo = await executeCommand(page, COMMANDS.getNotebookInfo, {
      notebookPath
    });
    expect(notebookInfo.success).toBe(true);
    expect(notebookInfo.notebookPath).toBe(notebookPath);
    expect(notebookInfo.cellCount).toBe(2);
    expect(await page.notebook.getCellType(0)).toBe('markdown');
    expect(await page.notebook.getCellType(1)).toBe('code');
    await expect(await page.notebook.getCellInputLocator(0)).toContainText(
      '# Title'
    );
    await expect(await page.notebook.getCellInputLocator(0)).toContainText(
      'Body'
    );
    await expect(await page.notebook.getCellInputLocator(1)).toContainText(
      'value = 41'
    );
    await expect(await page.notebook.getCellInputLocator(1)).toContainText(
      'value + 1'
    );

    const saveResult = await executeCommand(page, COMMANDS.saveNotebook, {
      notebookPath
    });
    expect(saveResult.success).toBe(true);
  });

  test('should update notebook cells through set-cell-content', async ({
    page,
    tmpPath
  }) => {
    const notebookPath = `${tmpPath}/command-set-cell-content.ipynb`;

    await executeCommand(page, COMMANDS.createNotebook, {
      language: 'python',
      name: notebookPath
    });
    await executeCommand(page, COMMANDS.addCell, {
      content: 'before = 1',
      notebookPath
    });
    await executeCommand(page, COMMANDS.addCell, {
      cellType: 'markdown',
      content: 'Old text',
      notebookPath
    });

    // Need the cellId to test setCellContent by cellId
    const markdownCell = await executeCommand(page, COMMANDS.getCellInfo, {
      cellIndex: 1,
      notebookPath
    });

    await executeCommand(page, COMMANDS.setCellContent, {
      cellId: markdownCell.cellId,
      content: '## Updated markdown',
      notebookPath,
      showDiff: false
    });
    await executeCommand(page, COMMANDS.setCellContent, {
      cellIndex: 0,
      content: 'answer = 6 * 7',
      notebookPath,
      showDiff: false
    });

    expect(await page.notebook.getCellCount()).toBe(2);
    await expect(await page.notebook.getCellInputLocator(0)).toContainText(
      'answer = 6 * 7'
    );
    await expect(await page.notebook.getCellInputLocator(1)).toContainText(
      'Updated markdown'
    );

    const saveResult = await executeCommand(page, COMMANDS.saveNotebook, {
      notebookPath
    });
    expect(saveResult.success).toBe(true);
  });

  test('should run and delete notebook cells', async ({ page, tmpPath }) => {
    const notebookPath = `${tmpPath}/command-run-and-delete.ipynb`;

    await executeCommand(page, COMMANDS.createNotebook, {
      language: 'python',
      name: notebookPath
    });
    await executeCommand(page, COMMANDS.addCell, {
      content: 'print("alpha")',
      notebookPath
    });
    await executeCommand(page, COMMANDS.addCell, {
      content: 'print("beta")',
      notebookPath
    });
    await page.locator('#jp-main-statusbar').getByText('Idle').waitFor();

    const runResult = await executeCommand(page, COMMANDS.runCell, {
      cellIndex: 0,
      notebookPath
    });
    expect(runResult.success).toBe(true);
    expect(runResult.hasOutput).toBe(true);

    await page.waitForCondition(async () => {
      const output = await page.notebook.getCellTextOutput(0);
      return output?.[0]?.trim() === 'alpha';
    });

    const deleteResult = await executeCommand(page, COMMANDS.deleteCell, {
      cellIndex: 1,
      notebookPath
    });
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.remainingCells).toBe(1);
    expect(await page.notebook.getCellCount()).toBe(1);
    expect(await page.notebook.getCellType(0)).toBe('code');

    const saveResult = await executeCommand(page, COMMANDS.saveNotebook, {
      notebookPath
    });
    expect(saveResult.success).toBe(true);

    const output = await page.notebook.getCellTextOutput(0);
    expect(output).not.toBeNull();
    expect(output?.[0].trim()).toBe('alpha');
  });
});
