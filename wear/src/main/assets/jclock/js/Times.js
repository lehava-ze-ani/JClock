//set the sunset and sunrise
function doit() {

    var nsi, ewi;
    var i;


    if (ns != "N")
        nsi = 1;
    else
        nsi = 0;

    if (ns != "W")
        ewi = 1;
    else
        ewi = 0;

    //console.log(tz);
    var adj = -(12 - tz);
    adj += dst;

    var sunrise = 0, sunset, sunrise_tommorow, sunset_yasterdate;
    var shaa_zmanit = 0;
    var hour = []; //29

	var yasterday,today,tomorrow;
	if(birthYear == null)
	{
		yasterday = new Date();
		today = new Date();
		tomorrow = new Date();
	}
	else
	{
		yasterday = new Date(birthYear,birthMonth-1,birthDay);
		today = new Date(birthYear,birthMonth-1,birthDay);
		tomorrow = new Date(birthYear,birthMonth-1,birthDay);
		adj = birthGMT;
	}
    yasterday.setDate(today.getDate() - 1);
    tomorrow.setDate(today.getDate() + 1);
		
    //the time of yasterday
    var time_yasterday = [0, 0, 0, 0];
	
	time_yasterday[2] = convertDateTimeToFloat(SunCalc.getMoonTimes(yasterday, latitude, longitude).rise);
	time_yasterday[3] = convertDateTimeToFloat(SunCalc.getMoonTimes(yasterday, latitude, longitude).set);	
    //time_yasterday = suntime(yasterday.getDate(), yasterday.getMonth() +1, yasterday.getYear(), 90, 50, lngd, lngm, ewi, latd, latm, nsi, adj);

    //the time of the current day
    var time_today = [0, 0, 0, 0];
    //time_today = suntime(today.getDate(), today.getMonth() +1, today.getYear(), 90, 50, lngd, lngm, ewi, latd, latm, nsi, adj);
	time_today[2] = convertDateTimeToFloat(SunCalc.getMoonTimes(today, latitude, longitude).rise);
	time_today[3] = convertDateTimeToFloat(SunCalc.getMoonTimes(today, latitude, longitude).set);	

    //the time of the next day
    var time_tommorow = [0, 0, 0, 0];
    //time_tommorow = suntime(tomorrow.getDate(), tomorrow.getMonth() +1, tomorrow.getYear(), 90, 50, lngd, lngm, ewi, latd, latm, nsi, adj);
	time_tommorow[2] = convertDateTimeToFloat(SunCalc.getMoonTimes(tomorrow, latitude, longitude).rise);
	time_tommorow[3] = convertDateTimeToFloat(SunCalc.getMoonTimes(tomorrow, latitude, longitude).set);	


    //if (time_today[1] == 0) {
        sunrise_yasterday = time_yasterday[2];
        sunrise = time_today[2];
        sunrise_tommorow = time_tommorow[2];
        sunset_yasterday = time_yasterday[3];
        sunset = time_today[3];
        sunset_tommorow = time_tommorow[3];
		
		hour[0] = sunrise_yasterday;
		hour[1] = sunrise;
		hour[2] = sunrise_tommorow;
		hour[3] = sunset_yasterday;
		hour[4] = sunset;
		hour[5] = sunset_tommorow;
		
        shaa_zmanit = (sunset - sunrise) / 12;



        //using current time in the computer to adjust the right secdule...
        //get the time right now
        var date = new Date();

		var h,minute,s,m;
		if(birthHour == null)
		{
			h = date.getHours();
			minute = date.getMinutes();
			s = date.getSeconds();
			m = date.getMilliseconds();
		}
		else
		{
			h = birthHour;
			minute = birthMin;
			s = 0;
			m = 0;
		}
		
		var curr_hour = m + (s*1000) + (minute*60*1000) + (h*60*60*1000); 

        var str = timeadj1(sunset);
        var sunsetArray = str.split(":");
        sunsetH = sunsetArray[0];
        sunsetM = sunsetArray[1];
        sunsetS = sunsetArray[2];
		sunsetMili = sunsetArray[3];
        var sunset_hour =  parseInt(sunsetMili) + parseInt((sunsetS*1000)) + parseInt((sunsetM*60*1000)) + parseInt((sunsetH*60*60*1000));
		//-----------------------------------------------------------------

        //document.getElementById("Masechet").value = shaa_zmanit_night;

        //legnth of the shaa zmanit - night
        //if (h > sunsetH || (h == sunsetH && minute > sunsetM) || (h == sunsetH && minute == sunsetM && s > sunsetS))
	    
		//document.getElementById("Sefer").value = sunrise_tommorow; 
		if(curr_hour > sunset_hour)
			shaa_zmanit_night = Math.abs((sunrise_tommorow + (24 - sunset)) / 12);
        else
            shaa_zmanit_night = Math.abs((sunrise + (24 - sunset_yasterdate)) / 12);
//        hour[25] = shaa_zmanit_night;

        //legnth of the shaa zmanit - day
        if(curr_hour > sunset_hour)
			shaa_zmanit_day = Math.abs((sunset_tommorow - sunrise_tommorow) / 12);
        else
			shaa_zmanit_day = Math.abs((sunset - sunrise) / 12);
//		hour[26] = shaa_zmanit_day;

 
		//seconds of shaa zmanit
        hour[27] = Math.floor(shaa_zmanit_night * 3600.0 + 0.5);   //night
        hour[28] = Math.floor(shaa_zmanit_day * 3600.0 + 0.5);      //day
        //----------------------
		
		//mili seconds of shaa zmanit
		hour[29] = Math.floor(shaa_zmanit_night * 3600.0 * 1000);   //night
		hour[30] = Math.floor(shaa_zmanit_day * 3600.0 * 1000);      //day

        //insert an array of shaot_zmaniot
        var s1, s2,s3,s4;
        if (curr_hour > sunset_hour) {
            s1 = sunset;
            s2 = sunrise_tommorow;
			s3 = sunset_tommorow;
        }
        else {
            s1 = sunset_yasterdate;
            s2 = sunrise;
			s3 = sunset;
        }

/*
        for (i = 0,s4=s1; i <= 11; i++, s4 += shaa_zmanit_night) 
		{
            hour[i] = timeadj1(s4);
        }
		
		for (i = 12,s4=s2; i <= 23; i++, s4 += shaa_zmanit_day) 
		{

            hour[i] = timeadj1(s4);
        }
        //------------------------------
*/		
		publicSunrise = s2;
		birkutHashahar = s2 - 42/60; // 42 regular minutes before sunrise -- ברכות השחר
		patachEliyaou = s2 - 38/60;// =  timeadj(s2 - 38/60, ampm); // 38 regular minutes before sunrise -- פתח אליהו
		korbanot = s2 - 35/60;// = 		 timeadj(s2 - 35/60, ampm);	// 35 regular minutes before sunrise -- קורבנות
		psokeiDzimra = s2 - 22/60;// =   timeadj(s2 - 22/60, ampm); // 22 regular minutes before sunrise -- פסוקי דזמרה
		yozerOr = s2 - 8/60;// =	     timeadj(s2 - 8/60, ampm);  // 08 regular minutes before sunrise -- יוצר אור
		kriyahtShema = s2 - 4/60;// =   timeadj(s2 - 4/60, ampm);	// 04 regular minutes before sunrise -- קריאת שמע

		
		
		//משיכיר
		if( curr_hour > sunset_hour )
			time = suntime(tomorrow.getDate(), tomorrow.getMonth() +1, tomorrow.getYear(), 101, 0, lngd, lngm, ewi, latd, latm, nsi, adj);
        else
			time = suntime(today.getDate(), today.getMonth() +1, today.getYear(), 101, 0, lngd, lngm, ewi, latd, latm, nsi, adj);
		
		if (time[1] == 0)
			misheyakir = time[2];

		//צאת הכוכבים
		if( curr_hour > sunset_hour )
			time = suntime(today.getDate(), today.getMonth() +1, today.getYear(), 96, 0, lngd, lngm, ewi, latd, latm, nsi, adj);
        else
			time = suntime(today.getDate(), today.getMonth() +1, today.getYear(), 96, 0, lngd, lngm, ewi, latd, latm, nsi, adj);
		
		if (time[1] == 0)
            tzeit = time[3];

		
    //}



    return hour;

}