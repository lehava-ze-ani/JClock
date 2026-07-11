//mazal of the hour
function setmazal_man() {
    var date;
	if(birthYear == null)
		date = new Date();
	else
		date = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));

    var h, m, s;
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



    var day = date.getDay() + 1;
    var clockHour = lbHour;
    if (clockHour == 24)
        clockHour = 0;

    if ((h == sunsetH_man && m == sunsetM_man && s >= sunsetS_man) ||    // אחרי שקיעה
        (h == sunsetH_man && m > sunsetM_man) ||
        (h > sunsetH_man)
       )
        if ((h == 23 && m == 23 && s <= 59) ||    // לפני חצות
            (h == 23 && m < 59) ||
            (h < 23)
           )
            day = day + 1;


    //document.getElementById("test").value = h > sunsetH;

    if (day == 8)
        day = 1;

    hebrewday_man = day;
}
