function hebrewDayOffset()
{
	//doit_man();
	hebrewclock_man();
	setmazal_man();

	
	//console.log("lbHour - " + lbHour);
	//console.log("lbHour4Man - " + lbHour4Man);
	
	//consolge.log(hebrewday_man)
	
	var dayDiffFromMan = (hebrewday - hebrewday_man + 7) % 7;
	var womanMoonTime = (Number(lbHour) * 1080) + Number(lbMinute);
	var manSunTime = (Number(lbHour4Man) * 1080) + Number(lbMinute4Man);
	
	if(dayDiffFromMan == 1)
		return -1;
	
	if(dayDiffFromMan == 0 && womanMoonTime > manSunTime)
		return -1;
	
	return 0;
}

function hasFullBirthCalculationParams()
{
	return birthYear != null && birthYear !== "" &&
		birthMonth != null && birthMonth !== "" &&
		birthDay != null && birthDay !== "" &&
		birthHour != null && birthHour !== "" &&
		birthMin != null && birthMin !== "" &&
		birthGMT != null && birthGMT !== "";
}
