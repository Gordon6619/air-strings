// Johann Pachelbel, Canon per 3 Violini e Basso.
// Derived from the score typeset by Michael Fischer v. Mollard (2015),
// Mutopia-2015/09/02-2047, CC BY 4.0. Converted to timed plucked-string parts.
// https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047
// https://creativecommons.org/licenses/by/4.0/
// Each row is one 4/4 bar. Durations are in 32nd notes. ~ continues a tie.
const subject = [
  'F#5/8 E5/8 D5/8 C#5/8',
  'B4/8 A4/8 B4/8 C#5/8',
  'D5/8 C#5/8 B4/8 A4/8',
  'G4/8 F#4/8 G4/8 E4/8',
  'D4/4 F#4/4 A4/4 G4/4 F#4/4 D4/4 F#4/4 E4/4',
  'D4/4 B3/4 D4/4 A4/4 G4/4 B4/4 A4/4 G4/4',
  'F#4/4 D4/4 E4/4 C#5/4 D5/4 F#5/4 A5/4 A4/4',
  'B4/4 G4/4 A4/4 F#4/4 D4/4 D5/4 D5/6 C#5/2',
  'D5/2 C#5/2 D5/2 D4/2 C#4/2 A4/2 E4/2 F#4/2 D4/2 D5/2 C#5/2 B4/2 C#5/2 F#5/2 A5/2 B5/2',
  'G5/2 F#5/2 E5/2 G5/2 F#5/2 E5/2 D5/2 C#5/2 B4/2 A4/2 G4/2 F#4/2 E4/2 G4/2 F#4/2 E4/2',
  'D4/2 E4/2 F#4/2 G4/2 A4/2 E4/2 A4/2 G4/2 F#4/2 B4/2 A4/2 G4/2 A4/2 G4/2 F#4/2 E4/2',
  'D4/2 B3/2 B4/2 C#5/2 D5/2 C#5/2 B4/2 A4/2 G4/2 F#4/2 E4/2 B4/2 A4/2 B4/2 A4/2 G4/2',
  'F#4/4 F#5/4 E5/8 r/4 D5/4 F#5/8',
  'B5/8 A5/8 B5/8 C#6/8',
  'D6/4 D5/4 C#5/8 r/4 B4/4 D5/8',
  'D5/12 D5/4 D5/4 G5/4 E5/4 A5/4',
  'A5/2 F#5/1 G5/1 A5/2 F#5/1 G5/1 A5/1 A4/1 B4/1 C#5/1 D5/1 E5/1 F#5/1 G5/1 F#5/2 D5/1 E5/1 F#5/2 F#4/1 G4/1 A4/1 B4/1 A4/1 G4/1 A4/1 F#4/1 G4/1 A4/1',
  'G4/2 B4/1 A4/1 G4/2 F#4/1 E4/1 F#4/1 E4/1 D4/1 E4/1 F#4/1 G4/1 A4/1 B4/1 G4/2 B4/1 A4/1 B4/2 C#5/1 D5/1 A4/1 B4/1 C#5/1 D5/1 E5/1 F#5/1 G5/1 A5/1',
  'F#5/2 D5/1 E5/1 F#5/2 E5/1 D5/1 E5/1 C#5/1 D5/1 E5/1 F#5/1 E5/1 D5/1 C#5/1 D5/2 B4/1 C#5/1 D5/2 D4/1 E4/1 F#4/1 G4/1 F#4/1 E4/1 F#4/1 D5/1 C#5/1 D5/1',
  'B4/2 D5/1 C#5/1 B4/2 A4/1 G4/1 A4/1 G4/1 F#4/1 G4/1 A4/1 B4/1 C#5/1 D5/1 B4/2 D5/1 C#5/1 D5/2 C#5/1 B4/1 C#5/1 D5/1 E5/1 D5/1 C#5/1 D5/1 B4/1 C#5/1',
  'D5/4 r/4 C#5/4 r/4 B4/4 r/4 D5/4 r/4',
  'D4/4 r/4 D4/4 r/4 D4/4 r/4 E4/4 r/4',
  'r/4 A4/4 r/4 A4/4 r/4 F#4/4 r/4 A4/4',
  'r/4 G4/4 r/4 F#4/4 r/4 G4/4 r/4 E5/4',
  'F#5/2 F#4/2 G4/2 F#4/2 E4/2 E5/2 F#5/2 E5/2 D5/2 F#4/2 D4/2 B4/2 A4/2 A3/2 G3/2 A3/2',
  'B3/2 B4/2 C#5/2 B4/2 A4/2 A3/2 G3/2 A3/2 B3/2 B4/2 A4/2 B4/2 C#5/2 C#4/2 B3/2 C#4/2',
  'D4/2 D5/2 E5/2 D5/2 C#5/2 C#4/2 D4/2 C#4/2 B3/2 B4/2 A4/2 B4/2 C#5/2 C#4/2 F#4/2 E4/2',
  'D4/2 D5/2 E5/2 G5/2 F#5/2 F#4/2 A4/2 F#5/2 D5/2 G5/2 F#5/2 G5/2 E5/2 A4/2 G4/2 A4/2',
  'F#4/2 A4/2 A4/2 A4/2 A4/2 A4/2 A4/2 A4/2 F#4/2 F#4/2 F#4/2 F#4/2 F#4/2 F#4/2 A4/2 A4/2',
  'G4/2 G4/2 G4/2 D5/2 D5/2 D5/2 D5/2 D5/2 D5/2 D5/2 B4/2 B4/2 A4/2 A4/2 E5/2 C#5/2',
  'A4/2 F#5/2 F#5/2 F#5/2 E5/2 E5/2 E5/2 E5/2 D5/2 D5/2 D5/2 D5/2 A5/2 A5/2 A5/2 A5/2',
  'B5/2 B5/2 B5/2 B5/2 A5/2 A5/2 A5/2 A5/2 B5/2 B5/2 B5/2 B5/2 C#6/2 C#5/2 C#5/2 C#5/2',
  'D5/2 D4/1 E4/1 F#4/2 D4/2 C#4/2 C#5/1 D5/1 E5/2 C#5/2 B4/2 B3/1 C#4/1 D4/2 B3/2 C#4/2 A4/1 G4/1 F#4/2 E4/2',
  'D4/2 G4/1 F#4/1 E4/2 G4/2 F#4/2 D4/1 E4/1 F#4/2 A4/2 G4/2 B4/1 A4/1 G4/2 F#4/2 E4/2 A4/1 G4/1 F#4/2 E4/2',
  'F#4/2 D5/1 C#5/1 D5/2 F#4/2 A4/2 A4/1 B4/1 C#5/2 A4/2 F#4/2 D5/1 E5/1 F#5/2 D5/2 F#5/2 F#5/1 E5/1 D5/2 C#5/2',
  'B4/2 B4/1 A4/1 B4/2 C#5/2 D5/2 F#5/1 E5/1 D5/2 F#5/2 G5/2 D5/1 C#5/1 B4/2 B4/2 A4/2 E4/2 A4/2 A4/2',
  'A4/12 A4/4 D4/12 A4/4',
  'G4/8 A4/8 G4/4 D4/4 D4/6 C#4/2',
  'D4/4 D5/4 C#5/8 B4/8 A4/8',
  'D4/6 E4/2 F#4/8 B4/8 E4/6 E4/2',
  'F#4/6 F#5/2 F#5/2 G5/2 F#5/2 E5/2 D5/6 D5/2 D5/2 E5/2 D5/2 C#5/2',
  'B4/8 D5/8 D5/2 C5/2 B4/2 C5/2 A4/6 A4/2',
  'A4/6 A5/2 A5/2 B5/2 A5/2 G5/2 F#5/6 F#5/2 F#5/2 G5/2 F#5/2 E5/2',
  'D5/2 C5/2 B4/2 C5/2 A4/6 A4/2 G4/4 D5/4 C#5/6 C#5/2',
  'D5/4 D5/8 C#5/8 B4/8 A4/4',
  '~A4/4 G4/8 F#4/4 ~F#4/6 E4/2 E4/8',
  'F#4/4 F#5/8 E5/4 D5/4 D6/8 C6/4',
  'B5/8 D6/4 A5/4 B5/8 A5/8',
  'A5/8 A4/6 G4/2 F#4/8 F#5/6 E5/2',
  'D5/12 D5/4 D5/8 C#5/8'
];
const closing = [
  'D5/4 D4/4 C#4/4 C#5/4 B4/4 B3/4 A3/4 A4/4',
  'G4/4 G5/4 F#5/4 F#4/4 E4/4 B4/4 E4/4 E5/4',
  'F#5/4 F#4/4 E4/4 E5/4 D5/4 D4/4 C#4/4 C#5/4',
  'B4/4 B5/4 A5/4 A4/4 G4/6 E5/2 A4/4 A4/4'
];
const cadence = ['A4/8 r/8 r/16','F#5/8 r/8 r/16','D5/8 r/8 r/16'];
const semitones = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};

function addPart(events, bars, startBar, voice) {
  let tick=startBar*32, previous=null;
  for(const bar of bars){
    for(const token of bar.split(' ')){
      const [pitch,length]=token.split('/');
      const ticks=Number(length),duration=ticks/8;
      if(pitch.startsWith('~')){
        previous.duration+=duration;
      }else if(pitch!=='r'){
        const midi=12*(Number(pitch.at(-1))+1)+semitones[pitch[0]]+(pitch.includes('#')?1:0);
        const lead=voice===1 || (voice===0 && tick<64);
        const strength=[.55,.76,.63,.60][voice]+(tick%32===0 ? .08 : 0);
        previous={beat:tick/8,midi,duration,voice,lead,strength};
        events.push(previous);
      }
      tick+=ticks;
    }
  }
  return tick/8;
}

function buildCanon() {
  const events=[];
  const ground=['D3/8 A2/8 B2/8 F#2/8','G2/8 D2/8 G2/8 A2/8'];
  const bass=Array.from({length:56},(_,i)=>ground[i%2]);
  bass.push('D3/8 r/8 r/16');
  const beats=addPart(events,bass,0,0);
  for(let i=0;i<3;i++){
    const bars=subject.concat(closing.slice(0,4-2*i),cadence[i]);
    const end=addPart(events,bars,2+2*i,i+1);
    if(end!==beats)throw Error('卡農聲部的終止小節不一致');
  }
  events.sort((a,b)=>a.beat-b.beat || Number(a.lead)-Number(b.lead) || a.voice-b.voice);
  return {id:'canon',title:'D 大調卡農',composer:'帕海貝爾',bpm:84,beatsPerBar:4,beats,events,
    colors:['#70f1dc','#71aaff','#eaa7ff']};
}
export const canon=buildCanon();
