#!/usr/bin/octave -qf

warning("off","Octave:nested-functions-coerced");

args=argv();

if size(args,1)!=2
  printf("usage: ./distortion.m <RD-1.out> <rate>\n");
  return
end

rd1=load("-ascii",args{1});
chosen_rate_log = log(str2double(args{2}));

rd1=flipud(sortrows(rd1,1));

rate1_log=log(rd1(:,3)*8./rd1(:,2));
psnr1=rd1(:,4);
psnrhvs1=rd1(:,5);
ssim1=rd1(:,6);
fastssim1=rd1(:,7);

pin = program_invocation_name;

chdir(pin(1:(length(pin)-length(program_name))));

printf("%0.5f\n",interp1(rate1_log,psnr1,chosen_rate_log));
printf("%0.5f\n",interp1(rate1_log,psnrhvs1,chosen_rate_log));
printf("%0.5f\n",interp1(rate1_log,ssim1,chosen_rate_log));
printf("%0.5f\n",interp1(rate1_log,fastssim1,chosen_rate_log));


