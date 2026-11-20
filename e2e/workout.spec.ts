import { expect, test } from '@playwright/test';

/** Smoke test: a workout survives closing the app, can be completed, and ends up in the history. */
test('log, reload and finish a workout', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { useStore } = await import('/src/store/store.ts');
    useStore.setState((x) => ({ settings: { ...x.settings, onboarded: true } }));
    const mk = (id: string) => ({ id: 'r' + id, exerciseId: id, restSec: 60, sets: [1, 2].map(() => ({ type: 'normal', weight: 60, reps: 8 })) });
    const r = { id: 'rt-e2e', name: 'E2E Push', createdAt: Date.now(), exercises: [mk('bench-press')] };
    useStore.getState().saveRoutine(r as never);
    useStore.getState().startWorkout(r as never);
  });

  // "Closing the app": a full reload must bring the unfinished workout back.
  await page.waitForTimeout(800);
  await page.goto('/#/workout');
  await page.reload();
  await expect(page.getByRole('textbox').first()).toHaveValue('E2E Push', { timeout: 20_000 });

  const checks = page.getByRole('button', { name: 'Done', exact: true });
  await expect(checks).toHaveCount(2);
  await checks.nth(0).click();
  await checks.nth(1).click();

  await page.getByRole('button', { name: /^Finish$/ }).first().click();
  await expect(page.getByText('All 2 sets are complete')).toBeVisible();
  await page.getByRole('button', { name: /^Finish$/ }).last().click();

  await page.goto('/#/history');
  await expect(page.getByText('E2E Push').first()).toBeVisible();
});
