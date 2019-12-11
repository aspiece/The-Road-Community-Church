# Verse Beat
in_thread do
  sleep 4
  loop do
    sample :drum_bass_soft
    sleep 0.25
    sample :drum_snare_soft
    sleep 0.25
    sample :drum_cymbal_soft
    sleep 0.5
    sample :drum_bass_soft
    sleep 0.5
    sample :drum_snare_soft
    sleep 0.25
    sample :drum_cymbal_soft
    sleep 0.25
  end
end




# function defining minor chords
define :minor_chord_player do |root, repeats, beat|
  repeats.times do
    use_synth :piano
    play chord(root, :minor), attack: 0.3, sustain: 0.1, amp: 3
    sleep beat
  end
end
# function defining major chords
define :major_chord_player do |root, repeats, beat|
  repeats.times do
    use_synth :piano
    play chord(root, :major), attack: 0.3, sustain: 0.1, cutoff: 1, amp: 3
    sleep beat
  end
end

#Hope for all mankind
#The Road Community Church
#Chord Progression

define :chorus do |repeat|
  4.times do
    major_chord_player :d, 3, 1
    major_chord_player :g, 1, 1
  end
  2.times do
    minor_chord_player :e, 1, 1
    major_chord_player :d, 1, 1
  end
  major_chord_player :g, 1, 1
  major_chord_player :a, 1, 1
  major_chord_player :d, 1, 2
end

define :verse do |repeat|
  minor_chord_player :b, 3, 1
  major_chord_player :d, 4, 1
  major_chord_player :g, 4, 1
  minor_chord_player :fs, 2.5, 1
  major_chord_player :g, 2.5, 1
  minor_chord_player :b, 3, 1
end

#intro
#Bm   /D    /G    /F#m    /G    Bm
minor_chord_player :b, 1, 0.5
major_chord_player :d, 1, 0.5
major_chord_player :g, 1, 0.5
minor_chord_player :fs, 1, 0.5
major_chord_player :g, 1, 0.5
minor_chord_player :b, 1, 0.5

verse 2
chorus 1
verse 1
chorus 2

#tag
2.times do
  minor_chord_player :e, 1, 1
  major_chord_player :d, 1, 1
end
major_chord_player :g, 1, 1
major_chord_player :a, 1, 1
major_chord_player :d, 1, 2

