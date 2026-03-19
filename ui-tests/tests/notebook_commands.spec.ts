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

function normalizeText(value: string | string[] | undefined | null): string {
  return Array.isArray(value) ? value.join('') : (value ?? '');
}

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

async function readNotebook(
  page: IJupyterLabPageFixture,
  notebookPath: string
): Promise<any> {
  return page.evaluate(async notebookPath => {
    await window.jupyterapp.started;
    const model = await window.jupyterapp.serviceManager.contents.get(
      notebookPath,
      { content: true, type: 'notebook' }
    );
    return model.content;
  }, notebookPath);
}

async function reopenNotebook(
  page: IJupyterLabPageFixture,
  notebookPath: string
): Promise<void> {
  if (await page.notebook.isAnyActive()) {
    await page.notebook.close(false);
  }
  await page.notebook.openByPath(notebookPath);
  await page.notebook.activate(notebookPath.split('/').pop()!);
}

test.describe('Notebook Commands', () => {
  test.use({ serverFiles: 'only-on-failure' });

  test('should create a notebook and persist the expected cells', async ({
    page,
    tmpPath
  }) => {
    const notebookPath = `${tmpPath}/command-create-and-add.ipynb`;

    const createResult = await executeCommand(page, COMMANDS.createNotebook, {
      language: 'python',
      name: notebookPath
    });
    expect(createResult.success).toBe(true);
    expect(createResult.kernel).toBe('python3');

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

    await executeCommand(page, COMMANDS.saveNotebook, { notebookPath });
    await reopenNotebook(page, notebookPath);

    const model = await readNotebook(page, notebookPath);
    expect(model.cells).toHaveLength(2);
    expect(model.cells.map((c: any) => c.cell_type)).toEqual([
      'markdown',
      'code'
    ]);
    expect(normalizeText(model.cells[0].source)).toBe('# Title\nBody');
    expect(normalizeText(model.cells[1].source)).toBe('value = 41\nvalue + 1');
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

    await executeCommand(page, COMMANDS.saveNotebook, { notebookPath });
    await reopenNotebook(page, notebookPath);

    const model = await readNotebook(page, notebookPath);
    expect(model.cells).toHaveLength(2);
    expect(normalizeText(model.cells[0].source)).toBe('answer = 6 * 7');
    expect(normalizeText(model.cells[1].source)).toBe('## Updated markdown');
  });

  test('should run and delete notebook cells while keeping saved state in sync', async ({
    page,
    tmpPath
  }) => {
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

    await executeCommand(page, COMMANDS.saveNotebook, { notebookPath });
    await reopenNotebook(page, notebookPath);

    const model = await readNotebook(page, notebookPath);
    expect(model.cells).toHaveLength(1);
    expect(normalizeText(model.cells[0].source)).toBe('print("alpha")');
    expect(model.cells[0].outputs).toHaveLength(1);
    expect(model.cells[0].outputs[0].output_type).toBe('stream');
    expect(normalizeText(model.cells[0].outputs[0].text)).toBe('alpha\n');
    expect(model.cells[0].execution_count).toBeGreaterThan(0);
  });
});
