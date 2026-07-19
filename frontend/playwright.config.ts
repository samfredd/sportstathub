import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',timeout:30_000,fullyParallel:true,retries:process.env.CI?2:0,
  reporter:process.env.CI?'github':'list',
  use:{baseURL:process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:3000',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:120_000},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],channel:process.env.CI?undefined:'chrome'}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],channel:process.env.CI?undefined:'chrome'}},
  ],
});
