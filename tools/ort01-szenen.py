# Szenen ORT-01 Richtungen. python scenes.py
import json
OUT="C:/Users/Luciu/projects/voxelwerk-ort01-richtung/assets/scenes/"
def terrain(W,D,fn,legend,pal="planet_mediterran"):
    rows=["".join(fn(x,z) for x in range(W)) for z in range(D)]
    return {"palette":pal,"depth":2,"jitter":0,"legend":legend,"rows":rows,"heights":["1"*W]*D}
def save(sc):
    json.dump(sc,open(OUT+sc["id"]+".json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
def cams(cx,cz,W):
    return {"uebersicht":{"target":[cx,0.8,cz],"dist":W*1.25,"elev":48,"az":28,"fov":36},
            "spielnah":{"target":[cx,0.5,cz+0.5],"dist":W*1.15,"elev":72,"az":0,"fov":36}}

def station(sid,name,pal,floor,place,detail,mood="hall_metall",W=10,D=8):
    leg={"a":{"h":1,"top":floor[0],"fill":"#2A2A2E"},"b":{"h":1,"top":floor[1],"fill":"#2A2A2E"}}
    t=terrain(W,D,lambda x,z:"a" if (x+z)%2==0 else "b",leg)
    c=cams(W/2,D/2,W); c["detail"]=detail
    save({"id":sid,"name":name,"palette":pal,"mood":mood,"terrain":t,"place":place,"cameras":c})

def aussen(sid,name,pal,fn,legend,place,detail,mood="planet_day",W=20,D=14,tpal="planet_mediterran"):
    t=terrain(W,D,fn,legend,tpal)
    c=cams(W/2,D/2,W); c["detail"]=detail
    save({"id":sid,"name":name,"palette":pal,"mood":mood,"terrain":t,"place":place,"cameras":c})

A="ort/rom/aquaedukt/"
G2="glow2"
Z={"glow":"glow2"}
# ---------- R1 Aquädukt
station("ort-r1-station","ORT-01 Rom A Aquädukt: Reaktorraum","rom",["#D9CFBA","#B9AE98"],[
 {"model":A+"wand","at":[5,0.25],"params":{"len":40}},
 {"model":A+"wand","at":[0.25,4],"rot":90,"params":{"len":32}},
 {"model":A+"reaktor","at":[5,3]},
 {"model":A+"terminal","at":[1.1,3.5],"rot":90},
 {"model":A+"zellenarkade","at":[8,0.9]},
 {"model":"rom/energiezelle","at":[7.375,0.9],"colors":Z},
 {"model":"rom/energiezelle","at":[8,0.9],"colors":Z},
 {"model":"rom/energiezelle","at":[8.625,0.9],"colors":Z,"params":{"charge":1}},
 {"model":A+"leitung","at":[2.2,0.85]},
 {"model":"rom/kiste","at":[8.4,5.6],"rot":15},
 {"model":"rom/energiezelle","at":[7.6,6.4],"colors":Z,"params":{"charge":2}},
 {"model":"rom/energiezelle","at":[8.2,6.6],"colors":Z,"params":{"charge":0}},
 {"model":"rom/standarte","at":[1.0,6.6],"rot":90},
],{"target":[3.6,1.0,3.0],"dist":7.5,"elev":30,"az":50,"fov":36})

def r1t(x,z):
    if z>=11: return "s"
    if 1<=x<=18 and 0<=z<=10: return "p"
    return "g"
legR={"g":{"h":1,"top":{"noise":["grass","grass_dark","grass_light"],"weights":[3,2,1]},"fill":"soil"},
      "p":{"h":1,"top":"#CFC4AE","fill":"soil"},
      "s":{"h":1,"top":"#9C9079","fill":"soil"}}
aussen("ort-r1-aussen","ORT-01 Rom A Aquädukt: Außenposten-Hof","rom",r1t,legR,[
 {"model":A+"halle","at":[7.5,4]},
 {"model":A+"clipeus","at":[14,2.6],"rot":180},
 {"model":A+"sensorturm","at":[16.5,1.5]},
 {"model":A+"leitung","at":[12.6,4],"rot":90,"params":{"n":3}},
 {"model":A+"verteiler","at":[14.5,6.5]},
 {"model":A+"zellenarkade","at":[2.5,9.2]},
 {"model":"rom/energiezelle","at":[1.875,9.2],"colors":Z},
 {"model":"rom/energiezelle","at":[2.5,9.2],"colors":Z},
 {"model":"rom/energiezelle","at":[3.125,9.2],"colors":Z},
 {"model":"rom/energiezelle","at":[5,9.6],"colors":Z,"row":{"count":3,"step":[0.55,0]}},
 {"model":"rom/kiste","at":[10.5,8.6],"rot":10},
 {"model":"rom/kiste","at":[11.3,9.3],"rot":-20},
 {"model":"rom/standarte","at":[8.5,10.6]},
 {"model":"rom/standarte","at":[12.5,10.6]},
 {"model":"rom/laterne","at":[17.5,9]},
],{"target":[13.5,1.3,5.5],"dist":10,"elev":26,"az":30,"fov":36})

# ---------- R2 Legio
L="ort/rom/legio/"
station("ort-r2-station","ORT-01 Rom B Legio: Reaktorraum","rom",["#3A3D44","#2E3137"],[
 {"model":L+"wand","at":[5,0.25],"params":{"len":40}},
 {"model":L+"wand","at":[0.25,4],"rot":90,"params":{"len":32}},
 {"model":L+"reaktor","at":[5,3]},
 {"model":L+"terminal","at":[1.1,3.5],"rot":90},
 {"model":L+"zellenschrank","at":[8,0.75]},
 {"model":"rom/standarte","at":[3.2,1.0]},
 {"model":"rom/energiezelle","at":[7.6,6.2],"params":{"charge":2}},
 {"model":"rom/energiezelle","at":[8.2,6.5],"params":{"charge":0}},
 {"model":"rom/kiste","at":[8.4,5.4],"rot":15},
],{"target":[3.6,1.0,3.0],"dist":7.5,"elev":30,"az":50,"fov":36})
def r2t(x,z):
    if z>=11: return "s"
    if 1<=x<=18 and 0<=z<=10: return "p"
    return "g"
legR2={"g":{"h":1,"top":{"noise":["grass","grass_dark","grass_light"],"weights":[3,2,1]},"fill":"soil"},
      "p":{"h":1,"top":"#55585E","fill":"soil"},
      "s":{"h":1,"top":"#3E4046","fill":"soil"}}
aussen("ort-r2-aussen","ORT-01 Rom B Legio: Außenposten-Hof","rom",r2t,legR2,[
 {"model":L+"halle","at":[7.5,4]},
 {"model":L+"sensorturm","at":[16.5,1.5]},
 {"model":L+"verteiler","at":[14.5,6.5]},
 {"model":L+"zellenschrank","at":[2.5,9.4]},
 {"model":"rom/energiezelle","at":[4.6,9.6],"row":{"count":3,"step":[0.55,0]}},
 {"model":"rom/zellenregal","at":[12,9.3]},
 {"model":"rom/kiste","at":[10,8.6],"rot":10},
 {"model":"rom/standarte","at":[8.5,10.6]},
 {"model":"rom/standarte","at":[12.5,10.9]},
 {"model":"rom/barriere","at":[17,9.5],"rot":90},
],{"target":[13.5,1.3,5.5],"dist":10,"elev":26,"az":30,"fov":36})

# ---------- G1 Esse
E="ort/germanen/esse/"
station("ort-g1-station","ORT-01 Germanen A Esse: Reaktorraum","nord",["#4A4846","#3C3A38"],[
 {"model":E+"wand","at":[5,0.25],"params":{"len":40}},
 {"model":E+"wand","at":[0.25,4],"rot":90,"params":{"len":32}},
 {"model":E+"reaktor","at":[5,3]},
 {"model":E+"terminal","at":[1.1,3.5],"rot":90},
 {"model":E+"fassregal","at":[8,0.9]},
 {"model":E+"fasszelle","at":[7.6,6.2],"params":{"charge":2}},
 {"model":E+"fasszelle","at":[8.3,6.5],"params":{"charge":0}},
 {"model":E+"fasszelle","at":[2.6,1.0],"params":{"charge":3}},
 {"model":E+"fasszelle","at":[3.3,1.0],"params":{"charge":4}},
 {"model":"prop/germanen/gemein/kiste_stapel","at":[8.4,5.3],"rot":15},
],{"target":[3.6,1.0,3.0],"dist":7.5,"elev":30,"az":50,"fov":36})
legG={"g":{"h":1,"top":{"noise":["#6F7A55","#5E6849","#848C6A"],"weights":[3,2,1]},"fill":"#4A3F33"},
      "p":{"h":1,"top":{"noise":["#77786F","#696A62"],"weights":[2,1]},"fill":"#4A3F33"},
      "s":{"h":1,"top":"#55554F","fill":"#4A3F33"}}
aussen("ort-g1-aussen","ORT-01 Germanen A Esse: Außenposten-Hof","nord",r2t,legG,[
 {"model":E+"halle","at":[7.5,4],"rot":-90},
 {"model":E+"sensorturm","at":[16.5,1.5]},
 {"model":E+"verteiler","at":[14.5,6.5]},
 {"model":E+"fassregal","at":[2.5,9.3]},
 {"model":E+"fasszelle","at":[4.6,9.6],"row":{"count":3,"step":[0.65,0]}},
 {"model":"prop/germanen/gemein/kiste_stapel","at":[10,8.6],"rot":10},
 {"model":"prop/germanen/gemein/kiste_stapel","at":[11,9.2],"rot":-25},
],{"target":[13.5,1.3,5.5],"dist":10,"elev":26,"az":30,"fov":36})

# ---------- G2 Spant
S="ort/germanen/spant/"
station("ort-g2-station","ORT-01 Germanen B Spant: Reaktorraum","nord",["#5A6470","#4C5560"],[
 {"model":S+"wand","at":[5,0.25],"params":{"len":40}},
 {"model":S+"wand","at":[0.25,4],"rot":90,"params":{"len":32}},
 {"model":S+"reaktor","at":[5,3]},
 {"model":S+"terminal","at":[1.1,3.5],"rot":90},
 {"model":S+"hornregal","at":[8,0.8]},
 {"model":S+"hornzelle","at":[7.34,0.9]},
 {"model":S+"hornzelle","at":[7.78,0.9],"params":{"charge":3}},
 {"model":S+"hornzelle","at":[8.22,0.9],"params":{"charge":1}},
 {"model":S+"hornzelle","at":[7.6,6.2],"params":{"charge":2}},
 {"model":S+"hornzelle","at":[8.2,6.5],"rot":40,"params":{"charge":0}},
],{"target":[3.6,1.0,3.0],"dist":7.5,"elev":30,"az":50,"fov":36})
legG2={"g":{"h":1,"top":{"noise":["#C9D2D6","#B3BEC4","#DCE4E8"],"weights":[3,2,1]},"fill":"#6A6660"},
      "p":{"h":1,"top":{"noise":["#7E8790","#717A83"],"weights":[2,1]},"fill":"#6A6660"},
      "s":{"h":1,"top":"#5F6770","fill":"#6A6660"}}
aussen("ort-g2-aussen","ORT-01 Germanen B Spant: Außenposten-Hof","nord",r2t,legG2,[
 {"model":S+"halle","at":[7.5,4]},
 {"model":S+"sensorturm","at":[16.5,1.5]},
 {"model":S+"verteiler","at":[14.5,6.5]},
 {"model":S+"hornregal","at":[2.5,9.3],"params":{"belegt":4}},
 {"model":S+"hornzelle","at":[4.8,9.6],"row":{"count":3,"step":[0.55,0]}},
 {"model":S+"hornzelle","at":[10,8.6],"params":{"charge":1}},
],{"target":[13.5,1.3,5.5],"dist":10,"elev":26,"az":30,"fov":36},mood="outpost_frost")
