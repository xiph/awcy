#!/usr/bin/octave --quiet
a = load('-ascii', argv(){1});
b = load('-ascii', argv(){2});
rates = [0.005 0.02 0.06 0.2];
ra = a(:,3)*8./a(:,2);
rb = b(:,3)*8./b(:,2);
interp_type = 'spline';
met_name = {'    PSNR', ' PSNRHVS', '    SSIM', 'FASTSSIM'};
printf("          LOW (%%)  MEDIUM (%%) HIGH (%%)\n");
for m=1:4
   ya = a(:,3+m);
   yb = b(:,3+m);
   p = interp1(ra, ya, rates, interp_type);
   for k=1:length(rates)-1
      a_rate = interp1(ya, log(ra), p(k):.01:p(k+1), interp_type);
      b_rate = interp1(yb, log(rb), p(k):.01:p(k+1), interp_type);
      if !length(a_rate) || !length(b_rate)
        bdr(m,k) = NaN();
      else
        bdr(m,k)=100 * (exp(mean(b_rate-a_rate))-1);
      end
   end
   printf("%s %f %f %f\n", met_name{m}, bdr(m, 1), bdr(m, 2), bdr(m, 3));
end
