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

rate1=rd1(:,3)*8./rd1(:,2);
rate1_log=log(rate1);
q1=rd1(:,1);
q1_log=log(q1);

%plot(rate1_log,q1_log);

%pause();

printf("%0.5f\n",exp(interp1(rate1_log,q1_log,chosen_rate_log)));
