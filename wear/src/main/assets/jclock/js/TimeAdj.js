function timeadj(t) {
    return timeadj(t, false);
}

function timeadj(t, ampm) {

    var hour;
    var min;

    var time = t;

    hour = Math.floor(time);
    min = Math.floor((time - hour) * 60.0 + 0.5);

    if (min >= 60) {
        hour += 1;
        min -= 60;
    }

    if (hour < 0)
        hour += 24;

    var ampm_str;
    if (ampm) {
        ampm_str = (hour > 11) ? " PM" : " AM";
        hour %= 12;
        hour = (hour < 1) ? 12 : hour;
    }
    else
        ampm_str = "";

    if (hour > 23)
        hour -= 24;

    var str = hour + ":" + ((min < 10) ? "0" : "") + min + ampm_str;

    return str;
}

function timeadj1(t) {
    return timeadj1(t, false);
}

function timeadj1(t, ampm) {
    var hour;
    var min;
    var sec;
	var milisec;

    var time = t;

    hour = Math.floor(time);
    min = Math.floor((time - hour) * 60.0);
    sec = Math.floor((((time - hour) * 60.0) - min) * 60.0);
    milisec = Math.floor((((((time - hour) * 60.0) - min) * 60.0)-sec)*1000)%1000;
	
	//milisec = 2000;
	if(milisec >= 1000)
	{
		sec += 1;
		milisec /= 1000;
	}
		
    if (sec >= 60) {
        min += 1;
        sec -= 60;
    }

    if (min >= 60) {
        hour += 1;
        min -= 60;
    }

    if (hour < 0)
        hour += 24;

    var ampm_str;
    if (ampm) {
        ampm_str = (hour > 11) ? " PM" : " AM";
        hour %= 12;  
        hour = (hour < 1) ? 12 : hour;
    }
    else
        ampm_str = "";

    if (hour > 23)
        hour -= 24;

	var milisec_str = ((milisec < 10) ? "000" + milisec : (milisec<100) ? "00" + milisec : "0" + milisec);
	var str = hour + ":" + ((min < 10) ? "0" : "") + min + ":" + ((sec < 10) ? "0" : "") + sec + ":" + milisec_str;
    return str;
}