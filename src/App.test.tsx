import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import type { Writer } from './inference';
vi.mock('./inference', () => ({ LocalWriter: class {} }));
afterEach(cleanup);
function setup(supported = true) {
  const writer: Writer = {
    load: vi.fn().mockResolvedValue(undefined), cached: vi.fn().mockResolvedValue(false), remove: vi.fn().mockResolvedValue(undefined), dispose: vi.fn(),
    generate: vi.fn(async (_request, chunk) => { chunk('We might ship Friday.'); return { truncated: false }; }),
  };
  render(<App writer={writer} gpuCheck={() => Promise.resolve(supported)} />);
  return writer;
}
async function ready() {
  const button = screen.getByRole('button', { name: 'Download / load model' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await screen.findByRole('button', { name: 'Model ready' });
}
it('requires explicit model loading and disables unsupported devices', async () => {
  const writer = setup(false);
  expect(await screen.findByText(/WebGPU is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download / load model' })).toBeDisabled();
  expect(writer.load).not.toHaveBeenCalled();
});
it('runs an action with preferences, reviews changes, copies and undoes input replacement', async () => {
  const writer = setup(); await ready();
  fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'We might ship Acme Friday' } });
  fireEvent.change(screen.getByLabelText('Protected terms'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('Custom instruction'), { target: { value: 'Be direct' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fix grammar →' }));
  await waitFor(() => expect(screen.getByLabelText('Your result')).toHaveValue('We might ship Friday.'));
  expect(writer.generate).toHaveBeenCalledWith({ text: 'We might ship Acme Friday', action: 'grammar', terms: 'Acme', instruction: 'Be direct' }, expect.any(Function));
  expect(screen.getByText(/Review missing protected terms: Acme/)).toBeInTheDocument();
  expect(screen.getByText('Review grammar changes')).toBeInTheDocument();
  const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy result' })); await screen.findByText('Copied.'); expect(writeText).toHaveBeenCalledWith('We might ship Friday.');
  fireEvent.click(screen.getByRole('button', { name: 'Use as input' })); expect(screen.getByLabelText('Your text')).toHaveValue('We might ship Friday.');
  fireEvent.click(screen.getByRole('button', { name: 'Undo input change' })); expect(screen.getByLabelText('Your text')).toHaveValue('We might ship Acme Friday');
});
it('preserves the draft on errors and makes retry possible', async () => {
  const writer = setup(); vi.mocked(writer.generate).mockRejectedValue(new Error('lost device')); await ready();
  fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'My draft' } }); fireEvent.click(screen.getByRole('button', { name: 'Fix grammar →' }));
  expect(await screen.findByText(/Generation failed/)).toBeInTheDocument(); expect(screen.getByLabelText('Your text')).toHaveValue('My draft');
  expect(screen.getByRole('button', { name: 'Download / load model' })).toBeEnabled();
});
it('clears output and undo history and rejects overlong input', async () => {
  setup(); await ready(); fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'word '.repeat(501) } });
  expect(screen.getByRole('button', { name: 'Fix grammar →' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' })); expect(screen.getByLabelText('Your text')).toHaveValue(''); expect(screen.getByLabelText('Your result')).toHaveValue('');
});
