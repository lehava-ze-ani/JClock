var isStartPray = false;
var curr_hour;
var isPressLink = false;
function hebrewclock_man()
{

    let zmanit_hour = doit_man();       //get the 24 shaaotzmaniot
    
	let sunrise_yasterday = zmanit_hour[0];
	let sunrise = zmanit_hour[1];
	let sunrise_tommorow = zmanit_hour[2];
	let sunset_yasterday = zmanit_hour[3];
	let sunset = zmanit_hour[4];
	let sunset_tommorow = zmanit_hour[5];
	
	var shaa_zmanit_night, shaa_zmanit_day;
    
    var date = new Date();

	var h,m,s,milisec;

	if(birthHour == null)
    {
		h = date.getHours();
		m = date.getMinutes();
		s = date.getSeconds();
		milisec = date.getMilliseconds();
	}
	else
	{
		h = birthHour;
		m = birthMin;
		s = birthSec == null ? 0 : birthSec;
		milisec = birthMs == null ? 0 : birthMs;
	}
	let curr_hour = milisec + (s*1000) + (m*60*1000) + ((h)*60*60*1000);
	
	curr_hour = parseFloat(curr_hour)/(1000 * 3600);

	//console.log(curr_hour);
	let hour;// = Math.floor(12* (curr_hour_offset/length));
	let minute;// = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
	let second;// = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	
	//console.log("sunset - " + sunset);
	//console.log("sunrise - " + sunrise);
	//console.log("curr_hour - " + curr_hour);
	
	if(sunset > sunrise && curr_hour < sunset)
	{
		let length = sunset - sunrise;
		let curr_hour_offset = curr_hour - sunrise;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour4Man = hour+12;
		//document.getElementById("Hour").value = hour;
		lbMinute4Man = minute;
		//document.getElementById("Minute").value = lbMinute4Man;
		lbSecond4Man = second;
		//document.getElementById("Second").value = lbSecond4Man;
	}
	//case 2:
	//moonrise at 06:57 and moonset at 17:17
	//curr_hour earlier.
	if(sunset > sunrise && curr_hour < sunrise)
	{
		//console.log("2");
		let length = sunrise + 24-sunset_yasterday;
		let curr_hour_offset = curr_hour + 24-sunset_yasterday;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour4Man = hour;
		//document.getElementById("Hour").value = hour;
		lbMinute4Man = minute;
		//document.getElementById("Minute").value = lbMinute4Man;
		lbSecond4Man = second;
		//document.getElementById("Second").value = lbSecond4Man;
	}
	//case 3:
	//moonrise at 06:57 and moonset at 17:17
	//curr_hour after moonset.
	if(sunset > sunrise && curr_hour > sunset)
	{
		//console.log("3");
		let length = sunrise_tommorow + 24-sunset;
		let curr_hour_offset = curr_hour - sunset;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour4Man = hour;
		//document.getElementById("Hour").value = hour;
		lbMinute4Man = minute;
		//document.getElementById("Minute").value = lbMinute4Man;
		lbSecond4Man = second;
		//document.getElementById("Second").value = lbSecond4Man;
	}
	//month days 07-23	
	//moonrise at 13:05 and moonset at 00:00
	//curr_hour between them.
	if(sunset < sunrise  && curr_hour < sunrise)
	{
		//console.log("4");
		let length = sunrise - sunset;
		let curr_hour_offset = curr_hour - sunset;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour4Man = hour;
		//document.getElementById("Hour").value = hour;
		lbMinute4Man = minute;
		//document.getElementById("Minute").value = lbMinute4Man;
		lbSecond4Man = second;
		//document.getElementById("Second").value = lbSecond4Man;
	}
	//case 2:
	//moonrise at 13:05 and moonset at 00:00
	//curr_hour earlier.
	if(sunset < sunrise && curr_hour < sunset)
	{
		//console.log("5");
		let length = sunset + 24-sunrise_yasterday;
		let curr_hour_offset = curr_hour + 24-sunrise_yasterday;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour4Man = hour + 12;
		//document.getElementById("Hour").value = hour;
		lbMinute4Man = minute;
		//document.getElementById("Minute").value = lbMinute4Man;
		lbSecond4Man = second;
		//document.getElementById("Second").value = lbSecond4Man;
	}
	//case 3:
	//moonrise at 13:05 and moonset at 00:00
	//curr_hour after moonset.
	if(sunset < sunrise && curr_hour > sunrise)
	{
		//console.log("6");
		let length = sunset_tommorow + 24-sunrise;
		let curr_hour_offset = curr_hour - sunrise;
		
		hour = Math.floor(12* (curr_hour_offset/length));
		minute = Math.floor(12 * 1080 * (curr_hour_offset / length)) - hour*1080;
		second = Math.floor(12 * 1080 * 76 * (curr_hour_offset / length)) - (hour * 1080 * 76) - (minute * 76);
	    
		lbHour4Man = hour +12 ;
		//document.getElementById("Hour").value = hour;
		lbMinute4Man = minute;
		//document.getElementById("Minute").value = lbMinute4Man;
		lbSecond4Man = second;
		//document.getElementById("Second").value = lbSecond4Man;		
	}
}

//---clock timer---
function oTimerclock() 
{
	oTimer = setInterval(hebrewclock, 10);
}


function display_time()
{
	return;
	//---displaying the clock---
	//second
    if (lbSecond4Man < 10)
        document.getElementById("Second").value = "0" + lbSecond4Man;
    else
        document.getElementById("Second").value = lbSecond4Man;

    //minute
    if (lbMinute4Man < 10)
        document.getElementById("Minute").value = "000" + lbMinute4Man;
    else if (lbMinute4Man < 100)
        document.getElementById("Minute").value = "00" + lbMinute4Man;
    else if (lbMinute4Man < 1000)
        document.getElementById("Minute").value = "0" + lbMinute4Man;
    else
        document.getElementById("Minute").value = lbMinute4Man;

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
		var s = 0;
	}
	//document.getElementById("ChirstianHour").value = h<10? "0" + h : h;
	//document.getElementById("ChirstianMinute").value = m<10? "0" + m : m ;
	//document.getElementById("ChirstianSecond").value = s<10? "0" + s : s;

	
}

function markTime()
{	
	//console.log("curr_hour: " + curr_hour);
	//console.log("tzeit: " + tzeit);
	//console.log("misheyakir: " + misheyakir);
	//console.log("sunset: " + 	sunset);
	//document.getElementById("Minute").style.color = "#FF0000";

	if(curr_hour > tzeit  || 
	   curr_hour < misheyakir)
	{
		document.getElementById("Hour").style.color = "#878787";
		document.getElementById("HebrewText2").style.color = "#878787";
		document.getElementById("Minute").style.color = "#878787";
		document.getElementById("HebrewText4").style.color = "#878787";
		document.getElementById("Second").style.color = "#878787";
	}
	else if(curr_hour < sunset && 
			curr_hour > misheyakir/*curr_hour.toDouble() > sunrise_hour.toDouble()*/ )
	{
		document.getElementById("Hour").style.color = "#5DBCD2";
		document.getElementById("HebrewText2").style.color = "#5DBCD2";
		document.getElementById("Minute").style.color = "#5DBCD2";
		document.getElementById("HebrewText4").style.color = "#5DBCD2";
		document.getElementById("Second").style.color = "#5DBCD2";


		//if(curr_hour.toDouble() < sunrise_hour.toDouble() || lbHour4Man.toNumber() < 6)
		//{ 
			//viewMazal.setText("Shacharit");			
			//viewMazal.setText("שחרית - " + text);
		//}
		//else if(lbHour4Man.toNumber() > 6 || (lbHour4Man.toNumber() == 6 && lbMinute4Man.toNumber() >= 540)) 
		//{
			//viewMazal.setText("Mincha");
			//viewMazal.setText("מנחה - " + text);
		//}			
	}
	//return;
	document.getElementById("HebrewText2").style.color = "#878787";
	document.getElementById("HebrewText4").style.color = "#878787";


	if(curr_hour > sunset  || 
	   curr_hour < sunrise)
	{
		document.getElementById("Minute").style.color = "#878787";
	}
	else if(curr_hour < sunset && 
			curr_hour > sunrise/*curr_hour.toDouble() > sunrise_hour.toDouble()*/ )
	{
		document.getElementById("Minute").style.color = "#A6230E";
	}


	if(curr_hour > shaa  || 
	   curr_hour < fajar)
	{
		//document.getElementById("Hour").style.color = "#878787";
		//document.getElementById("HebrewText2").style.color = "#878787";
		//document.getElementById("Minute").style.color = "#878787";
		//document.getElementById("HebrewText4").style.color = "#878787";
		document.getElementById("Second").style.color = "#878787";
	}
	else if(curr_hour < asr && 
			curr_hour > fajar/*curr_hour.toDouble() > sunrise_hour.toDouble()*/ )
	{
		//document.getElementById("Hour").style.color = "#5DBCD2";
		//document.getElementById("HebrewText2").style.color = "#5DBCD2";
		//document.getElementById("Minute").style.color = "#5DBCD2";
		//document.getElementById("HebrewText4").style.color = "#00FF00";
		document.getElementById("Second").style.color = "#84C45E";
	}
	else if(curr_hour > asr )
	{
		//document.getElementById("Hour").style.color = "#5DBCD2";
		//document.getElementById("HebrewText2").style.color = "#5DBCD2";
		//document.getElementById("Minute").style.color = "#5DBCD2";
		//document.getElementById("HebrewText4").style.color = "#00FF00";
		document.getElementById("Second").style.color = "#BA8D1A";
	}
		//if(curr_hour.toDouble() < sunrise_hour.toDouble() || lbHour4Man.toNumber() < 6)
		//{ 
			//viewMazal.setText("Shacharit");			
			//viewMazal.setText("שחרית - " + text);
		//}
		//else if(lbHour4Man.toNumber() > 6 || (lbHour4Man.toNumber() == 6 && lbMinute4Man.toNumber() >= 540)) 
		//{
			//viewMazal.setText("Mincha");
			//viewMazal.setText("מנחה - " + text);
		//}			
	
	
	
}

