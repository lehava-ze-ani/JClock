//set the latitude and longtiude minutes and time zone for calculations
function list_pos() {
    if (latitude > 0)
        ns = "N";
    else
        ns = "S";
    latd = Math.floor(latitude);
    latm = ((latitude - latd) * 60);
    if (longitude > 0)
        ew = "E";
    else
        ew = "W";
    lngd = Math.floor(longitude);
    lngm = ((longitude - lngd) * 60);
    var _tz = tz;


    /*if ((latd != -1) && (lngd != -1)) {*/
        tz = 12 + _tz;
        //doit();
    //}
}
