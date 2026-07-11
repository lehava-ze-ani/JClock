//mazal of the hour
function setmazal() 
{
	
	var date;
	if(birthYear == null)
		date = new Date();
	else
		date = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
	
	var h,m,s;
	if(birthHour == null)
	{
		h = date.getHours();
		m = date.getMinutes();
		s = date.getSeconds();
	}
	else
	{
		h = Number(birthHour);
		m = Number(birthMin);
		s = 0;
	}
	
	var day = getDisplayHebrewDay(date, h, m, s);
	hebrewday = day;
	var mazalDayOffset = hebrewDayOffset();
	var displayDayOffset = hasFullBirthCalculationParams() ? mazalDayOffset : 0;
	var displayDate = getOffsetDate(date, displayDayOffset);
	hebrewday = normalizeHebrewDay(day + mazalDayOffset);
	var isNight = isDisplayNight(h, m, s);
	
	var userLang = navigator.language || navigator.userLanguage;	
	
	if (userLang.includes("he")) 
	{
		var hebrew_month_name = hebrewDate(displayDate.getYear()+1900, displayDate.getMonth()+1, displayDate.getDate(), "Hebrew");
		document.getElementById('Mazal').innerText = hebrew_month_name['date'] + " ב" + hebrew_month_name['month_name'];// + ", " + getHebrewDayLabel(hebrewday, isNight);
	}
	else
	{
		var hebrew_month_name = hebrewDate(displayDate.getYear()+1900, displayDate.getMonth()+1, displayDate.getDate(),"English");
		document.getElementById('Mazal').innerText = hebrew_month_name['date'] + " at " + hebrew_month_name['month_name'];// + ", " + getEnglishDayLabel(hebrewday, isNight);
	}
		
	document.body.style.backgroundImage = "url('pic/7.jpg')";
	
	//return;

    var clockHour = lbHour;
    if (clockHour == 24)
        clockHour = 0;

	//console.log("hebrewday: " + hebrewday);
	//console.log("clockHour: " + clockHour);

    var day_mida = ["חסד", "גבורה", "תפארת", "נצח", "הוד", "יסוד", "מלכות"];
    var x = 0;
    if (hebrewday == 1)
        x = (5 + clockHour) % 7;
    if (hebrewday == 2)
        x = (1 + clockHour) % 7;
    if (hebrewday == 3)
        x = (4 + clockHour) % 7;
    if (hebrewday == 4)
        x = (0 + clockHour) % 7;
    if (hebrewday == 5)
        x = (3 + clockHour) % 7;
    if (hebrewday == 6)
        x = (6 + clockHour) % 7;
    if (hebrewday == 7)
        x = (2 + clockHour) % 7;


	switch (x) 
	{
		case (1):
			//document.getElementById("Mazal").setAttribute("ondblclick" ,"window.open('tel:+972527401735')");
			paintText("#2D8DA1");
			//document.body.style.backgroundImage = "url('pic/1.jpg')";
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			omer = ((day - 1) * 7) + 1;
			break;
		case (2):
			//document.getElementById("Mazal").setAttribute("href","tel:+972587401735");
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			paintText("#A6230E");
			//document.body.style.backgroundImage = "url('pic/2.jpg')";
			omer = ((day - 1) * 7) + 2;
			break;
		case (3):
			//document.getElementById("Mazal").setAttribute("ondblclick" ,"window.open('tel:+972527401735')");
			//document.getElementById("Mazal").setAttribute("href","tel:+972548887390");
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			paintText("#815AA8")
			//document.body.style.backgroundImage = "url('pic/3.jpg')";
			omer = ((day - 1) * 7) + 3;
			break;
		case (0):
			//document.getElementById("Mazal").setAttribute("href","tel:+972587401735");
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			paintText("#84C45E");
			//document.body.style.backgroundImage = "url('pic/4.jpg')";
			//omer = ((day - 1) * 7) + 4;
			break;
		case (4):
			//document.getElementById("Mazal").setAttribute("href","tel:+972524295486");
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			paintText("#BA8D1A");
			//document.body.style.backgroundImage = "url('pic/5.jpg')";
			//omer = ((day - 1) * 7) + 5;
			break;
		case (5):
			//document.getElementById("Mazal").setAttribute("href","tel:+972587401735");
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			paintText("#B45D02");
			//document.body.style.backgroundImage = "url('pic/6.jpg')";
			//omer = ((day - 1) * 7) + 6;
			break;
		case (6):
			//document.getElementById("Mazal").setAttribute("href","tel:+972526071874");
			//document.getElementById("Mazal").innerText = day_mida[day - 1];
			paintText("#808080");
			//document.body.style.backgroundImage = "url('pic/7.jpg')";
			//omer = ((day - 1) * 7) + 7;
			break;
		default:
			break;
	}
}

function paintText(p_color)
{
	var clockInputs = document.getElementsByClassName("clock");
	for(var i=0 ; i< clockInputs.length ; i++)
		clockInputs[i].style.color = p_color;
}

function getDisplayHebrewDay(date, h, m, s)
{
	var displayDay = date.getDay() + 1;
	
	if(birthHour == null)
	{
		if ((h == sunsetH && m == sunsetM && s >= sunsetS) ||
			(h == sunsetH && m > sunsetM) ||
			(h > sunsetH))
			displayDay = displayDay + 1;
	}
	
	if(displayDay == 8)
		displayDay = 1;
	
	return displayDay;
}

function isDisplayNight(h, m, s)
{
	var currHour = Number(h) + (Number(m) / 60) + (Number(s) / 3600);
	var sunsetHour = Number(sunsetH) + (Number(sunsetM) / 60) + (Number(sunsetS) / 3600);
	
	if(currHour >= sunsetHour)
		return true;
	
	if(typeof publicSunrise != "undefined" && currHour < Number(publicSunrise))
		return true;
	
	return false;
}

function getHebrewDayLabel(dayNumber, isNight)
{
	return (isNight ? "ליל " : "יום ") + getHebrewDayName(dayNumber);
}

function getHebrewDayName(dayNumber)
{
	var hebrewDayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
	return hebrewDayNames[dayNumber - 1];
}

function getEnglishDayLabel(dayNumber, isNight)
{
	return getEnglishDayName(dayNumber) + (isNight ? " night" : " day");
}

function getEnglishDayName(dayNumber)
{
	var englishDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	return englishDayNames[dayNumber - 1];
}

function normalizeHebrewDay(dayNumber)
{
	while(dayNumber < 1)
		dayNumber += 7;

	while(dayNumber > 7)
		dayNumber -= 7;

	return dayNumber;
}

function getOffsetDate(date, dayOffset)
{
	var offsetDate = new Date(date.getTime());
	offsetDate.setDate(offsetDate.getDate() + dayOffset);
	return offsetDate;
}

function getMazalHebrewDay()
{
	return normalizeHebrewDay(hebrewday);
}
