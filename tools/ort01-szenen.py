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
    c=cams(W/2,D/2,W); c["uebersicht"]["dist"]=29; c["uebersicht"]["target"]=[W/2,2.0,D/2-1]; c["detail"]=detail
    save({"id":sid,"name":name,"palette":pal,"mood":mood,"terrain":t,"place":place,"cameras":c})

RS="ort/rom/station/"; RG="ort/rom/gemein/"; RA="ort/rom/aussenposten/"
Z={}

G2="glow2"
Z={"glow":"glow2"}
# ---------- R1 Aquädukt
station("ort-r1-station","ORT-01 Rom: Reaktorraum","rom",["#D9CFBA","#B9AE98"],[
 {"model":RS+"wand","at":[5,0.25],"params":{"len":40}},
 {"model":RS+"wand","at":[0.25,4],"rot":90,"params":{"len":32}},
 {"model":RS+"reaktor","at":[5,3]},
 {"model":RS+"terminal","at":[1.1,3.5],"rot":90},
 {"model":RG+"zellenarkade","at":[8,0.9]},
 {"model":"rom/energiezelle","at":[7.375,0.9]},
 {"model":"rom/energiezelle","at":[8,0.9]},
 {"model":"rom/energiezelle","at":[8.625,0.9],"params":{"charge":1}},
 {"model":RG+"leitung","at":[2.2,0.85]},
 {"model":"rom/kiste","at":[8.4,5.6],"rot":15},
 {"model":"rom/energiezelle","at":[7.6,6.4],"params":{"charge":2}},
 {"model":"rom/energiezelle","at":[8.2,6.6],"params":{"charge":0}},
 {"model":"rom/standarte","at":[1.0,6.6],"rot":90},
],{"target":[3.6,1.0,3.0],"dist":7.5,"elev":30,"az":50,"fov":36})

def r1t(x,z):
    if z>=11: return "s"
    if 1<=x<=18 and 0<=z<=10: return "p"
    return "g"
legR={"g":{"h":1,"top":{"noise":["grass","grass_dark","grass_light"],"weights":[3,2,1]},"fill":"soil"},
      "p":{"h":1,"top":"#CFC4AE","fill":"soil"},
      "s":{"h":1,"top":"#9C9079","fill":"soil"}}
aussen("ort-r1-aussen","ORT-01 Rom: Außenposten-Hof","rom",r1t,legR,[
 {"model":RA+"halle","at":[7.5,4]},
 {"model":RA+"clipeus","at":[14,2.6]},
 {"model":RA+"sensorturm","at":[16.5,1.5]},
 {"model":RG+"leitung","at":[12.6,4],"rot":90,"params":{"n":3}},
 {"model":RG+"verteiler","at":[14.5,6.5]},
 {"model":RG+"zellenarkade","at":[2.5,9.2]},
 {"model":"rom/energiezelle","at":[1.875,9.2]},
 {"model":"rom/energiezelle","at":[2.5,9.2]},
 {"model":"rom/energiezelle","at":[3.125,9.2]},
 {"model":"rom/energiezelle","at":[5,9.6],"row":{"count":3,"step":[0.55,0]}},
 {"model":"rom/kiste","at":[10.5,8.6],"rot":10},
 {"model":"rom/kiste","at":[11.3,9.3],"rot":-20},
 {"model":"rom/standarte","at":[8.5,10.6]},
 {"model":"rom/standarte","at":[12.5,10.6]},
 {"model":"rom/laterne","at":[17.5,9]},
],{"target":[15.5,2.0,3.5],"dist":6.5,"elev":14,"az":25,"fov":36})


# ---------- Germanen (Stabbau + Esse)
GS="ort/germanen/station/"; GG="ort/germanen/gemein/"; GA="ort/germanen/aussenposten/"
station("ort-ger-station","ORT-01 Germanen: Reaktorraum","nord",["#6A6864","#5A5854"],[
 {"model":GS+"wand","at":[5,0.25],"params":{"len":40}},
 {"model":GS+"wand","at":[0.25,4],"rot":90,"params":{"len":32}},
 {"model":GS+"reaktor","at":[5,3]},
 {"model":GS+"terminal","at":[1.1,3.5],"rot":90},
 {"model":GG+"fassregal","at":[8,0.9]},
 {"model":GG+"verteiler","at":[2.6,0.9]},
 {"model":GG+"fasszelle","at":[7.6,6.2],"params":{"charge":2}},
 {"model":GG+"fasszelle","at":[8.3,6.5],"params":{"charge":0}},
 {"model":"prop/germanen/gemein/kiste_stapel","at":[8.4,5.3],"rot":15},
],{"target":[3.6,1.0,3.0],"dist":7.5,"elev":30,"az":50,"fov":36})
legG={"g":{"h":1,"top":{"noise":["#6F7A55","#5E6849","#848C6A"],"weights":[3,2,1]},"fill":"#4A3F33"},
      "p":{"h":1,"top":"#8A8A82","fill":"#4A3F33"},
      "s":{"h":1,"top":"#6A6A63","fill":"#4A3F33"}}
def gt(x,z):
    if z>=11: return "s"
    if 1<=x<=18 and 0<=z<=10: return "p"
    return "g"
aussen("ort-ger-aussen","ORT-01 Germanen: Außenposten-Hof","nord",gt,legG,[
 {"model":GA+"halle","at":[7.5,4]},
 {"model":GA+"sensorturm","at":[16.5,1.5]},
 {"model":GG+"verteiler","at":[14.5,6.5]},
 {"model":GG+"fassregal","at":[2.5,9.3]},
 {"model":GG+"fasszelle","at":[4.6,9.6],"row":{"count":3,"step":[0.65,0]}},
 {"model":"prop/germanen/gemein/kiste_stapel","at":[10,8.6],"rot":10},
 {"model":"prop/germanen/gemein/kiste_stapel","at":[11,9.2],"rot":-25},
],{"target":[15.5,2.0,3.5],"dist":6.5,"elev":14,"az":25,"fov":36})
