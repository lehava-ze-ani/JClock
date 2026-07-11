function Tefila()
{
	
	document.querySelector(".circular").style.display = "unset";

	//patachEliyaou
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";		
	}, 1000*60*4); //wait 4 minutes for the birkutHashahar will ends


	//patachEliyaou
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";
		
		//3m
		document.querySelector(".circle .left .progress").style.animation = "left 85s linear both";
		document.querySelector(".circle .right .progress").style.animation = "right 85s linear both";
		document.querySelector(".circle .right .progress").style.animationDelay = "85s";			
		document.querySelector(".number").innerText = "פתח אליהו";

		document.querySelector(".circular").style.display = "unset";
	}, 1000*60*4 + 10000); //wait 4 minutes + 10s for the birkutHashahar will ends

	//break between patachEliyaou & korbanot
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";
	}, 1000*60*4 + 1000*60*3); //wait 4+3 minutes for the patachEliyaou will ends

	//korbanot
	setTimeout(function() 
	{
		//13m
		document.querySelector(".circle .left .progress").style.animation = "left 385s linear both";
		document.querySelector(".circle .right .progress").style.animation = "right 385s linear both";
		document.querySelector(".circle .right .progress").style.animationDelay = "385s";			
		document.querySelector(".number").innerText = "קורבנות";

		document.querySelector(".circular").style.display = "unset";
	}, 1000*60*4 + 1000*60*3  + 10000); //wait 4+3 minutes + 10s for the patachEliyaou will ends

	//break between korbanot & psokeiDzimra
	setTimeout(function()
	{
		document.querySelector(".circular").style.display = "none";
	}, 1000*60*4 + 1000*60*3 + 1000*60*13); //wait 4+3+13 minutes for the korbanot will ends

	//psokeiDzimra
	setTimeout(function()
	{
		//14m
		document.querySelector(".circle .left .progress").style.animation = "left 415s linear both";
		document.querySelector(".circle .right .progress").style.animation = "right 415s linear both";
		document.querySelector(".circle .right .progress").style.animationDelay = "415s";			
		document.querySelector(".number").innerText = "פסוקי דזמרה";

		document.querySelector(".circular").style.display = "unset";
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 10000); //wait 4+3+13 minutes + 10s for the korbanot will ends

	//break between psokeiDzimra & YozerOr 
	setTimeout(function() 
	{		
		document.querySelector(".circular").style.display = "none";		
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14); //wait 4+3+13+14 minutes for the psokeiDzimra will ends

	//YozerOr
	setTimeout(function() 
	{		
		//4m
		document.querySelector(".circle .left .progress").style.animation = "left 115s linear both";
		document.querySelector(".circle .right .progress").style.animation = "right 115s linear both";
		document.querySelector(".circle .right .progress").style.animationDelay = "115s";			
		document.querySelector(".number").innerText = "יוצר אור";

		document.querySelector(".circular").style.display = "unset";
		
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14 + 10000); //wait 4+3+13+14 minutes + 10s for the psokeiDzimra will ends

	//break between YozerOr & kriyahtShema
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14 + 1000*60*4); //wait 4+3+13+14+4 minutes for the YozerOr will ends

	//kriyahtShema
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";

		//4m
		document.querySelector(".circle .left .progress").style.animation = "left 115s linear both";
		document.querySelector(".circle .right .progress").style.animation = "right 115s linear both";
		document.querySelector(".circle .right .progress").style.animationDelay = "115s";			
		document.querySelector(".number").innerText = "קריאת שמע";

		document.querySelector(".circular").style.display = "unset";		
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14 + 1000*60*4 + 10000); //wait 4+3+13+14+4 minutes + 10s for the YozerOr will ends

	//break between kriyahtShema & netz
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";		
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14 + 1000*60*4 + 1000*60*4); //wait 4+3+13+14+4+4 minutes for the kriyahtShema will ends


	//netz
	setTimeout(function() 
	{
		//6m
		document.querySelector(".circle .left .progress").style.animation = "left 180s linear both";
		document.querySelector(".circle .right .progress").style.animation = "right 180s linear both";
		document.querySelector(".circle .right .progress").style.animationDelay = "180s";			
		document.querySelector(".number").innerText = "תפילת שמונה עשרה";

		document.querySelector(".circular").style.display = "unset";
		
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14 + 1000*60*4 + 1000*60*4 + 10000); //wait 4+3+13+14+4+4 minutes + 10s for the kriyahtShema will ends

	//end of netz
	setTimeout(function() 
	{
		document.querySelector(".circular").style.display = "none";		
	}, 1000*60*4 + 1000*60*3 + 1000*60*13 + 1000*60*14 + 1000*60*4 + 1000*60*4 + + 1000*60*6); //wait 4+3+13+14+4+4+6 minutes for the netz will ends

}