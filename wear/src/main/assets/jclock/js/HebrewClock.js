var isStartPray = false;
var curr_hour;
var isPressLink = false;
var previousDigitalChazanHour = null;
function hebrewclock()
{

    var zmanit_hour = doit();       //get the 24 shaaotzmaniot
    
	var sunrise_yasterday = zmanit_hour[0];
	var sunrise = zmanit_hour[1];
	var sunrise_tommorow = zmanit_hour[2];
	var sunset_yasterday = zmanit_hour[3];
	var sunset = zmanit_hour[4];
	var sunset_tommorow = zmanit_hour[5];
	
	//console.log("zmanit_hour[0] :" + zmanit_hour[0]);
	//console.log("zmanit_hour[1] :" + zmanit_hour[1]);
	//console.log("zmanit_hour[2] :" + zmanit_hour[2]);
	//console.log("zmanit_hour[3] :" + zmanit_hour[3]);
	//console.log("zmanit_hour[4] :" + zmanit_hour[4]);
	//console.log("zmanit_hour[5] :" + zmanit_hour[5]);
	
	
	var shaa_zmanit_night, shaa_zmanit_day;
    
    var date = new Date();

	var h,m,s,milisec;
	if(birthHour == null)
    {
		var h = date.getHours();
		var m = date.getMinutes();
		var s = date.getSeconds();
		var milisec = date.getMilliseconds();
	}
	else
	{
		var h = birthHour;
		var m = birthMin;
		var s = birthSec == null ? 0 : birthSec;
		var milisec = birthMs == null ? 0 : birthMs;		
	}
	curr_hour = milisec + (s*1000) + (m*60*1000) + ((h)*60*60*1000);
	
	curr_hour = curr_hour/(1000 * 3600);

	//console.log("sunset: " + sunset);
	//console.log("sunrise: " + sunrise);
	//console.log("curr_hour: " + curr_hour);

	var hour;// = Math.floor(12* (curr_hour_offset/length));
	var minute;// = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
	var second;// = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	
	var isNight = true;
							
	//month days 23-7						
	//case 1:
	//moonrise at 06:57 and moonset at 17:17
	//curr_hour between them.
	if(sunset > sunrise && curr_hour < sunset)
	{
		var length = sunset - sunrise;
		var curr_hour_offset = curr_hour - sunrise;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour = hour+12;
		document.getElementById("Hour").value = hour;
		lbMinute = minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = second;
		document.getElementById("Second").value = lbSecond;
		
		isNight = false;
	}
	//case 2:
	//moonrise at 06:57 and moonset at 17:17
	//curr_hour earlier.
	if(sunset > sunrise && curr_hour < sunrise)
	{
		var length = sunrise + 24-sunset_yasterday;
		var curr_hour_offset = curr_hour + 24-sunset_yasterday;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour = hour;
		document.getElementById("Hour").value = hour;
		lbMinute = minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = second;
		document.getElementById("Second").value = lbSecond;
		
		isNight = true;
	}
	//case 3:
	//moonrise at 06:57 and moonset at 17:17
	//curr_hour after moonset.
	if(sunset > sunrise && curr_hour > sunset)
	{
		var length = sunrise_tommorow + 24-sunset;
		var curr_hour_offset = curr_hour - sunset;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour = hour;
		document.getElementById("Hour").value = hour;
		lbMinute = minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = second;
		document.getElementById("Second").value = lbSecond;
		
		isNight = true;
	}
	//month days 07-23	
	//moonrise at 13:05 and moonset at 00:00
	//curr_hour between them.
	if(sunset < sunrise  && curr_hour < sunrise)
	{
		var length = sunrise - sunset;
		var curr_hour_offset = curr_hour - sunset;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour = hour;
		document.getElementById("Hour").value = hour;
		lbMinute = minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = second;
		document.getElementById("Second").value = lbSecond;
		
		isNight = true;
	}
	//case 2:
	//moonrise at 13:05 and moonset at 00:00
	//curr_hour earlier.
	if(sunset < sunrise && curr_hour < sunset)
	{
		var length = sunset + 24-sunrise_yasterday;
		var curr_hour_offset = curr_hour + 24-sunrise_yasterday;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour = hour + 12;
		document.getElementById("Hour").value = hour;
		lbMinute = minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = second;
		document.getElementById("Second").value = lbSecond;
		
		isNight = false;
	}
	//case 3:
	//moonrise at 13:05 and moonset at 00:00
	//curr_hour after moonset.
	if(sunset < sunrise && curr_hour > sunrise)
	{
		var length = sunset_tommorow + 24-sunrise;
		var curr_hour_offset = curr_hour - sunrise;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour = hour +12 ;
		document.getElementById("Hour").value = hour;
		lbMinute = minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = second;
		document.getElementById("Second").value = lbSecond;
		
		isNight = false;
	}

	
	display_time();
	setmazal();	
	markTime(isNight);
	
	if(lbMinute == 0)
    {
		//document.getElementsByClassName("tefilaTool").display = "none";
		//document.getElementById("tefilaTool").style.display = "none";
		doit();
		setmazal();	
	}
	
	//if(curr_hour >= birkutHashahar &&  curr_hour < sunrise)
	//	window.location.href = "https://digitalchazan.web.app/woman";
	
	//else if(parseInt(document.getElementById("Hour").value) == 11)
	//{
		/*
		if(Math.random()*10>5)
			lbHour = 13;
		else
			lbHour = 11;
		document.getElementById("Hour").value = lbHour;
		lbMinute = 1080 - minute;
		document.getElementById("Minute").value = lbMinute;
		lbSecond = 76 - second;
		document.getElementById("Second").value = lbSecond;
		display_time();
		*/
	//	if(!isStartPray && (curr_hour > birkutHashahar)  && Math.abs(curr_hour - birkutHashahar) < 0.1)
	//	{
	//		Tefila();
	//		isStartPray = true;			
	//	}
	//		
	//}
		
	//if(lbHour == 6)
	//	isStartPray = false;
	var digitalChazanStart = getDigitalChazanStartTime(publicSunrise);
	var shouldOpenChazan = shouldOpenDigitalChazan(digitalChazanStart);
	previousDigitalChazanHour = curr_hour;
	if(shouldOpenChazan)
	{
		isPressLink = true;
		window.location.href = "./digitalChazan/index.html" + getDigitalChazanQueryString();
	}	

	
	//Tefila();
	//sunalert(curr_hour,lbHour,lbMinute,lbSecond);
    //if(lbMinute == 0 || lbMinute == 360 || lbMinute == 720)
    //    tick_sound();
}

function getDigitalChazanStartTime(tefilaSunriseTime)
{
	return isDigitalChazanShabatOrMoed(tefilaSunriseTime) ? tefilaSunriseTime - 1 : birkutHashahar;
}

function shouldOpenDigitalChazan(startTime)
{
	if(isPressLink || birthHour != null || previousDigitalChazanHour == null)
		return false;

	return didPassClockPoint(previousDigitalChazanHour, curr_hour, startTime);
}

function didPassClockPoint(previousHour, currentHour, targetHour)
{
	var previous = normalizeDayHour(previousHour);
	var current = normalizeDayHour(currentHour);
	var target = normalizeDayHour(targetHour);
	var maxRedirectDelay = 2 / 3600;

	if(current < previous)
		current += 24;

	while(target < previous)
		target += 24;

	return previous < target && current >= target && current - target <= maxRedirectDelay;
}

function normalizeDayHour(hour)
{
	hour = Number(hour);
	while(hour < 0)
		hour += 24;
	while(hour >= 24)
		hour -= 24;

	return hour;
}

function isDigitalChazanShabatOrMoed(tefilaSunriseTime)
{
	var date = getDigitalChazanDateForTefila(tefilaSunriseTime);
	return date.getDay() == 6 || isDigitalChazanMoed(date);
}

function getDigitalChazanDateForTefila(tefilaSunriseTime)
{
	var date = getDigitalChazanDate();
	if(tefilaSunriseTime == null)
		return date;

	var tefilaSunrise = normalizeDayHour(tefilaSunriseTime);
	var current = normalizeDayHour(curr_hour);
	if(tefilaSunrise < current)
		date.setDate(date.getDate() + 1);

	return date;
}

function getDigitalChazanDate()
{
	if(birthYear == null || birthMonth == null || birthDay == null)
		return new Date();

	return new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
}

function isDigitalChazanMoed(date)
{
	if(typeof hebrewDate !== "function")
		return false;

	var hebrewMonthName = hebrewDate(date.getFullYear(), date.getMonth() + 1, date.getDate(), "hebrew");
	var isMoed = false;

	isMoed = isMoed || (hebrewMonthName["month_name"] == "ניסן" && hebrewMonthName["date"].match("ט\"ו|כ\"א") != null);
	isMoed = isMoed || (hebrewMonthName["month_name"] == "סיוון" && hebrewMonthName["date"].match("ו'") != null);
	isMoed = isMoed || (hebrewMonthName["month_name"] == "תשרי" && hebrewMonthName["date"].match("ט\"ו|כ\"א|כ\"ב|א'|ב'|י'") != null);

	return isMoed;
}

function getDigitalChazanQueryString()
{
	var params = new URLSearchParams(window.location.search);
	params.set("longitude", longitude || 35.2331664);
	params.set("latitude", latitude || 31.7768514);
	return "?" + params.toString();
}


//---clock timer---
function oTimerclock() 
{
	oTimer = setInterval(hebrewclock, 10);
}


function display_time()
{
	//---displaying the clock---
	//second
    if (lbSecond < 10)
        document.getElementById("Second").value = "0" + lbSecond;
    else
        document.getElementById("Second").value = lbSecond;

    //minute
    if (lbMinute < 10)
        document.getElementById("Minute").value = "000" + lbMinute;
    else if (lbMinute < 100)
        document.getElementById("Minute").value = "00" + lbMinute;
    else if (lbMinute < 1000)
        document.getElementById("Minute").value = "0" + lbMinute;
    else
        document.getElementById("Minute").value = lbMinute;

	//hour
    if (document.getElementById("Hour").value < 10)
        document.getElementById("Hour").value = "0" + document.getElementById("Hour").value;
    else
        document.getElementById("Hour").value = document.getElementById("Hour").value;

	
	var date = new Date();

	var h,m,s
	if(birthHour == null)
    {
		var h = date.getHours();
		var m = date.getMinutes();
		var s = date.getSeconds();
	}
	else
	{
		var h = birthHour;
		var m = birthMin;
		var s = birthSec == null ? 0 : birthSec;
	}
	document.getElementById("ChirstianHour").value = h<10? "0" + h : h;
	document.getElementById("ChirstianMinute").value = m<10? "0" + m : m ;
	document.getElementById("ChirstianSecond").value = s<10? "0" + s : s;

	
}

function markTime(moonSleep)
{
	//console.log(moonSleep);
	
	if(moonSleep)
	{
		document.getElementById("Mazal").style.color = "#878787";

		//document.getElementById("Hour").style.color = "#878787";
		//document.getElementById("HebrewText2").style.color = "#878787";
		//document.getElementById("Minute").style.color = "#878787";
		//document.getElementById("HebrewText4").style.color = "#878787";
		//document.getElementById("Second").style.color = "#878787";
	}
	else
	{
		document.getElementById("Mazal").style.color = "white";

		//document.getElementById("Hour").style.color = "#CA2C92";
		//document.getElementById("HebrewText2").style.color = "#CA2C92";
		//document.getElementById("Minute").style.color = "#CA2C92";
		//document.getElementById("HebrewText4").style.color = "#CA2C92";
		//document.getElementById("Second").style.color = "#CA2C92";
	}
	
	
}

