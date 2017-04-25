#!/usr/bin/python3

import sqlite3
import scipy.stats

db = sqlite3.connect('subjective.sqlite3')

decoders = "[\"Base-LL\",\"Base-LL-ext_refs\"]"

videos = ['objective-1-fast/Netflix_DrivingPOV_1280x720_60fps_8bit_420_60f.y4m-55.ivf','objective-1-fast/Netflix_RollerCoaster_1280x720_60fps_8bit_420_60f.y4m-55.ivf','objective-1-fast/dark70p_60f.y4m-55.ivf']

cur = db.execute("SELECT * from votes WHERE decoders = ?;",(decoders,))

votes = cur.fetchall()

votes_per_user = {}

print('Votes per IP')
for vote in votes:
    if vote[6] in votes_per_user:
        votes_per_user[vote[6]] = votes_per_user[vote[6]] + 1
    else:
        votes_per_user[vote[6]] = 1
for user in votes_per_user:
    print(user, votes_per_user[user])

print('Number of votes:',str(len(votes)))

print('video a b t p-value')

for video in videos:
    cur = db.execute("SELECT * from votes WHERE decoders = ? AND selected = ? AND videos = ?;",(decoders,0,video))
    a = len(cur.fetchall())
    cur = db.execute("SELECT * from votes WHERE decoders = ? AND selected = ? AND videos = ?;",(decoders,1,video))
    b = len(cur.fetchall())
    cur = db.execute("SELECT * from votes WHERE decoders = ? AND selected = ? AND videos = ?;",(decoders,-1,video))
    t = len(cur.fetchall())
    print(video,':',a,b,t,scipy.stats.binom_test(a+t/2,a+b+t))


