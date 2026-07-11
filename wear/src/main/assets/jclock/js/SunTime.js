function suntime(
 dy, mn, yr,
 sundeg, sunmin,
 londeg, lonmin, ew,
 latdeg, latmin, ns,
 timezone) {
    // console.log("dy: " + dy + ", mn: " + mn + ", yr: " + yr);
    // console.log("sundeg: " + sundeg + ", sunmin: " + sunmin);
    // console.log("londeg: " + londeg + ", lonmin: " + lonmin + ", ew:" + ew);
    // console.log("latdeg: " + latdeg + ", latmin: " + latmin + ", ns:" + ns);
    // console.log("timezone: " + timezone);

    yr = yr -100 + 2000;


    var ret = [0, 0, 0, 0];

    var invalid = 0;	// start out as OK

    var longitude = (londeg + lonmin / 60.0) * ((ew == 0) ? -1 : 1);
    var latitude = (latdeg + latmin / 60.0) * ((ns == 0) ? 1 : -1);

    var yday = doy(dy, mn, yr);

    var A = 1.5708;
    var B = 3.14159;
    var C = 4.71239;
    var D = 6.28319;
    var E = 0.0174533 * latitude;
    var F = 0.0174533 * longitude;
    var G = 0.261799 * timezone;

    var R = Math.cos(0.01745 * (sundeg + sunmin / 60.0));

    var J;

    var sr = 0, ss = 0;

    // two times through the loop
    //    i=0 is for sunrise
    //    i=1 is for sunset
    for (i = 0; i < 2; i++) {

        if (i == 0)
            J = A;	// sunrise
        else
            J = C;	// sunset

        var K = yday + ((J - F) / D);
        var L = (K * .017202) - .0574039;              // Solar Mean Anomoly
        var M = L + .0334405 * Math.sin(L);            // Solar True Longitude
        M += 4.93289 + (3.49066E-04) * Math.sin(2 * L);

        // Quadrant Determination
        if (D == 0) {
            //MessageBox.Show("Trying to normalize with zero offset...");
            return ret;
        }

        while (M < 0)
            M = (M + D);

        while (M >= D)
            M = (M - D);

        if ((M / A) - Math.floor(M / A) == 0)
            M += 4.84814E-06;

        var P = Math.sin(M) / Math.cos(M);                   // Solar Right Ascension
        P = Math.atan2(.91746 * P, 1);

        // Quadrant Adjustment
        if (M > C)
            P += D;
        else {
            if (M > A)
                P += B;
        }

        var Q = .39782 * Math.sin(M);      // Solar Declination
        Q = Q / Math.sqrt(-Q * Q + 1);     // This is how the original author wrote it!
        Q = Math.atan2(Q, 1);

        var S = R - (Math.sin(Q) * Math.sin(E));
        S = S / (Math.cos(Q) * Math.cos(E));

        if (Math.abs(S) > 1)
            invalid = 1;	// uh oh! no sunrise/sunset

        S = S / Math.sqrt(-S * S + 1);
        S = A - Math.atan2(S, 1);

        if (i == 0)
            S = D - S;	// sunrise

        var T = S + P - 0.0172028 * K - 1.73364;  // Local apparent time
        var U = T - F;                            // Universal timer
        var V = U + G;                            // Wall clock time

        // Quadrant Determination
        if (D == 0) {
            //MessageBox.Show("Trying to normalize with zero offset...");
            return ret;
        }

        while (V < 0)
            V = V + D;
        while (V >= D)
            V = V - D;
        V = V * 3.81972;

        if (i == 0)
            sr = V;	// sunrise
        else
            ss = V;	// sunset
    }

    ret[1] = invalid;
    ret[2] = sr;
    ret[3] = ss;

    //console.log("sr: " + sr + ", ss: " + ss);

    return ret;
}

function doy(d, m, y) {
    var num = (m > 2 && leap(y)) ? 1 : 0;

    return monCount[m] + d + num;
}

function leap(y) {
    return ((y % 400 == 0) || (y % 100 != 0 && y % 4 == 0));
}
