#!/usr/bin/python3

import os
import sqlite3
import sys
import textwrap
import urllib.parse

import matplotlib.pyplot as plt
import scipy.stats

db = sqlite3.connect("subjective.sqlite3")

# decoders = "[\"Base-LL\",\"Base-LL-ext_refs\"]"

labels = ["daala-dist", "ref"]

# videos = ['objective-1-fast/Netflix_DrivingPOV_1280x720_60fps_8bit_420_60f.y4m-55.ivf','objective-1-fast/Netflix_RollerCoaster_1280x720_60fps_8bit_420_60f.y4m-55.ivf','objective-1-fast/dark70p_60f.y4m-55.ivf']
# decoders = '["https://beta.arewecompressedyet.com/runs/clpf-only-ll@2017-05-15T22:14:20.557Z/js/decoder.js","https://beta.arewecompressedyet.com/runs/master-ll@2017-05-15T22:12:29.122Z/js/decoder.js"]'
# decoders = '["https://beta.arewecompressedyet.com/runs/clpf-only@2017-05-08T17:19:44.308Z/js/decoder.js","https://beta.arewecompressedyet.com/runs/master@2017-05-02T00:51:52.225Z/js/decoder.js"]'
# decoders = '["https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective2_HL@2017-05-05T18:50:07.454Z/js/decoder.js","https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective4_HL@2017-05-10T00:44:26.235Z/js/decoder.js"]'
# decoders = '["https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective1_HL@2017-05-05T18:45:01.437Z/js/decoder.js","https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective4_HL@2017-05-10T00:44:26.235Z/js/decoder.js"]'
decoders = '["https://arewecompressedyet.com/runs/daala_dist_vartx_off_light_June13@2017-06-14T23:59:22.942Z/js/decoder.js","https://arewecompressedyet.com/runs/ref_vartx_off_light_June13@2017-06-15T00:00:21.112Z/js/decoder.js"]'
# videos = ['subjective-wip/MINECRAFT_420_300f.y4m-50.ivf','subjective-wip/Netflix_Crosswalk_1920x1080_30fps_8bit_420_300f.y4m-55.ivf','subjective-wip/Netflix_TunnelFlag_1920x1080_30fps_8bit_420_300f.y4m-55.ivf','subjective-wip/sintel_trailer_cut1.y4m-50.ivf','subjective-wip/vidyo1_720p_30fps_300f.y4m-55.ivf']
videos = [
    "subjective-wip/MINECRAFT_420_300f.y4m",
    "subjective-wip/Netflix_Crosswalk_1920x1080_30fps_8bit_420_300f.y4m",
    "subjective-wip/Netflix_TunnelFlag_1920x1080_30fps_8bit_420_300f.y4m",
    "subjective-wip/sintel_trailer_cut1.y4m",
    "subjective-wip/vidyo1_720p_30fps_300f.y4m",
]
# videos = ['subjective-wip/MINECRAFT_420_300f.y4m-50.ivf','subjective-wip/Netflix_Crosswalk_1920x1080_30fps_8bit_420_300f.y4m-50.ivf','subjective-wip/Netflix_TunnelFlag_1920x1080_30fps_8bit_420_300f.y4m-50.ivf','subjective-wip/sintel_trailer_cut1.y4m-50.ivf','subjective-wip/vidyo1_720p_30fps_300f.y4m-50.ivf']
# decoders = '["https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective2_HL@2017-05-05T18:50:07.454Z/js/decoder.js","https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective4_HL@2017-05-10T00:44:26.235Z/js/decoder.js"]'
# decoders = '["https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective1_HL@2017-05-05T18:45:01.437Z/js/decoder.js","https://arewecompressedyet.com/runs/RyanLei_ParallelDeblockingSubjective4_HL@2017-05-10T00:44:26.235Z/js/decoder.js"]'

cur = db.execute("SELECT * from votes WHERE decoders = ?;", (decoders,))

votes = cur.fetchall()

votes_per_user = {}

print("Votes per user")
for vote in votes:
    if vote[5] in votes_per_user:
        votes_per_user[vote[5]] = votes_per_user[vote[5]] + 1
    else:
        votes_per_user[vote[5]] = 1
for user in votes_per_user:
    print(user, votes_per_user[user])

# users who didn't vote on all 5 videos
blacklisted_users = []
print("Blacklisted users")
for k, v in votes_per_user.items():
    for video in videos:
        cur = db.execute(
            "SELECT * from votes WHERE decoders = ? AND videos LIKE ? AND voter = ?;",
            (decoders, video + "%", k),
        )
        if len(cur.fetchall()) < 1 and k not in blacklisted_users:
            blacklisted_users.append(k)
for u in blacklisted_users:
    print(u)


print("Number of votes:", str(len(votes)))
print(decoders)
print(
    "%40.40s   %5s %5s %5s %5s %.5s"
    % ("Video", labels[0], "Tie", labels[1], "Total", "P-value")
)

f, (ax1, ax2) = plt.subplots(1, 2, sharey=True)

total_a = 0
total_b = 0
total_t = 0


def compute_p_value(a, b, t):
    if a < b:
        p_value = scipy.stats.binom_test(a + t / 2, a + b + t)
    else:
        p_value = scipy.stats.binom_test(b + t / 2, a + b + t)
    return p_value


def get_non_duplicate_votes(db, video):
    cur = db.execute(
        "SELECT * from votes WHERE decoders = ? AND videos LIKE ?;",
        (decoders, video + "%"),
    )
    vote_by_user = {}
    for vote in cur.fetchall():
        vote_by_user[vote[5]] = vote[2]
    # print(vote_by_user)
    # vote_by_user = {k:v for k,v in vote_by_user.items() if votes_per_user[k] >= 5}
    vote_by_user = {k: v for k, v in vote_by_user.items() if k not in blacklisted_users}
    # print(vote_by_user)
    a = len([x for x in vote_by_user if vote_by_user[x] == 0])
    b = len([x for x in vote_by_user if vote_by_user[x] == 1])
    t = len([x for x in vote_by_user if vote_by_user[x] == -1])
    # print(a)
    return (a, b, t)


plt.title(decoders)
plot_num = 1
for video in videos:
    plt.subplot(1, len(videos), plot_num)
    plt.ylim(0, 13)
    plt.title("\n".join(textwrap.wrap(os.path.basename(video), 20)))
    plot_num += 1
    (a, b, t) = get_non_duplicate_votes(db, video)
    p_value = compute_p_value(a, b, t)
    print("%40.40s : %5d %5d %5d %5d %.5f" % (video, a, t, b, a + t + b, p_value))
    y_pos = [0, 1, 2]
    plt.xticks([0.5, 1.5, 2.5], [labels[0], "tie", labels[1]])
    bar = plt.bar(y_pos, [a, t, b])
    bar[0].set_facecolor("red")
    bar[1].set_facecolor("gray")
    bar[2].set_facecolor("green")
    total_a += a
    total_b += b
    total_t += t
fig = plt.gcf()
fig.set_size_inches(18.5, 10.5, forward=True)
plt.show()

print("Total p value: ", compute_p_value(total_a, total_b, total_t))
