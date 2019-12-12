tone = use_synth :piano
tone_amp = 2
bpm = use_bpm 124

in_thread do
  loop do
    sample "c:/samples/melody-010_124bpm_B_minor.wav", amp: 1, attack: 1
    sleep 16
  end
  
  
end

in_thread do
  bpm
  sleep 4
  loop do
    sample :drum_bass_soft
    sleep 1
    sample :drum_snare_soft
    sleep 1
    #sample :drum_cymbal_soft
  end
end




# function defining minor chords
define :minor_chord_player do |root, repeats, beat|
  repeats.times do
    use_synth tone
    play chord(root, :minor), attack: 0.3, sustain: 0.1, amp: tone_amp
    sleep beat
  end
end
# function defining major chords
define :major_chord_player do |root, repeats, beat|
  repeats.times do
    use_synth tone
    play chord(root, :major), attack: 0.3, sustain: 0.1, cutoff: 1, amp: tone_amp
    
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
  major_chord_player :d, 2, 2
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
bpm
sleep 9
minor_chord_player :b, 1, 0.5
major_chord_player :d, 1, 0.5
major_chord_player :g, 1, 0.5
minor_chord_player :fs, 1, 0.5
major_chord_player :g, 1, 0.5
minor_chord_player :b, 1, 0.5
sleep 1

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
major_chord_player :d, 1, 1

