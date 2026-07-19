import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';

test('public navigation, global search, and PRO routing work',async({page},testInfo)=>{
  test.skip(testInfo.project.name.startsWith('mobile'),'Desktop navigation assertion');
  const consoleErrors:string[]=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await page.goto('/');await expect(page.getByRole('link',{name:'Search'})).toBeVisible();
  await page.getByRole('link',{name:'Search'}).click();await page.getByRole('searchbox',{name:'Search SportStatHub'}).fill('creator');
  await expect(page.getByRole('heading',{name:'threads'})).toBeVisible();await expect(page.getByRole('link',{name:/Creator introductions/i}).first()).toBeVisible();
  await page.goto('/');await page.getByRole('link',{name:'Open Pro plan details'}).click();await expect(page).toHaveURL(/\/auth\/login(?:\?|$)/);
  expect(consoleErrors).toEqual([]);
});

test('mobile navigation is a keyboard-contained dialog',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('mobile'),'Mobile-only navigation assertion');
  await page.goto('/search');const trigger=page.getByRole('button',{name:'Open more navigation'});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'More navigation'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('link',{name:'Sign In'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
});

test('accessibility smoke has no serious or critical violations',async({page})=>{
  await page.goto('/search');
  const results=await new AxeBuilder({page}).analyze();
  const blocking=results.violations.filter(violation=>violation.impact==='serious'||violation.impact==='critical');
  expect(blocking,JSON.stringify(blocking,null,2)).toEqual([]);
});

test('admin routes reject anonymous users',async({page})=>{
  await page.goto('/admin/users');await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fusers/);
});
