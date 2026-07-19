import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailerService} from '../src/modules/mailer/mailer.service.js';

const config={
  resendApiKey:'re_test',emailFrom:'no-reply@sportstathub.test',emailFromName:'SportStatHub',contactEmail:'support@sportstathub.test',
};

test('mailer sends OTP through the Resend API with text and HTML fallbacks',async()=>{
  const deliveries:any[]=[];
  const client={emails:{send:async(payload:any)=>{deliveries.push(payload);return {data:{id:'email_1'},error:null}}}} as any;
  const mailer=createMailerService(config,client);
  const result=await mailer.sendOtpEmail({to:'user@example.test',otp:'123456'});
  assert.equal(result?.id,'email_1');assert.equal(deliveries[0].from,'SportStatHub <no-reply@sportstathub.test>');
  assert.equal(deliveries[0].to,'user@example.test');assert.match(deliveries[0].text,/123456/);assert.match(deliveries[0].html,/123456/);
});

test('mailer surfaces Resend API errors and never reports a false success',async()=>{
  const client={emails:{send:async()=>({data:null,error:{message:'domain is not verified',name:'validation_error'}})}} as any;
  const mailer=createMailerService(config,client);
  await assert.rejects(()=>mailer.sendWelcomeEmail({to:'user@example.test',username:'sam'}),/domain is not verified/);
});

test('contact email uses the configured inbox and escapes submitted HTML',async()=>{
  const deliveries:any[]=[];
  const client={emails:{send:async(payload:any)=>{deliveries.push(payload);return {data:{id:'email_2'},error:null}}}} as any;
  const mailer=createMailerService(config,client);
  await mailer.sendContactEmail({name:'Sam\r\nBcc: injected@example.test',email:'sam@example.test',message:'Hello <script>alert(1)</script>'});
  assert.equal(deliveries[0].to,'support@sportstathub.test');assert.equal(deliveries[0].replyTo,'sam@example.test');
  assert.equal(deliveries[0].subject,'Contact form: Sam Bcc: injected@example.test');
  assert.doesNotMatch(deliveries[0].html,/<script>/);assert.match(deliveries[0].html,/&lt;script&gt;/);
});
